// src/controllers/clasesController.js
// Una "Clase" vive dentro de un Tema (modulo) y agrupa: título, una grabación
// corta (video_url externo o subido a GCS) y una descripción. Los temas se
// muestran en orden secuencial (Clase 1, Clase 2, ...).
import pool from '../database.js';
import {
  uploadClaseVideoToGCS, deleteClaseVideoFromGCS,
  uploadClasePdfToGCS, deleteClasePdfFromGCS,
  uploadClasePresentacionToGCS, deleteClasePresentacionFromGCS,
  getClasePresentacionFile,
} from '../services/gcsClases.js';

// Deduce el tipo de presentación por la extensión del archivo.
const tipoPresentacion = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'svg') return 'svg';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'ppt' || ext === 'pptx') return 'pptx';
  return 'pdf';
};

// Presentaciones de una clase. Tolera que la tabla `clase_presentaciones` aún no
// exista (migración pendiente): en ese caso devuelve [] en vez de romper la carga
// de la clase. Cubre la ventana entre desplegar el código y correr la migración.
const fetchPresentacionesDeClase = async (claseId) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, tipo, url, orden FROM clase_presentaciones WHERE clase_id=$1 ORDER BY orden ASC, created_at ASC',
      [claseId]
    );
    return rows;
  } catch (err) {
    if (err.code === '42P01') return []; // undefined_table → migración pendiente
    throw err;
  }
};

const getModuloDelNegocio = async (moduloId, businessId) => {
  const { rows } = await pool.query(
    'SELECT id, business_id FROM modulos WHERE id = $1 AND business_id = $2',
    [moduloId, businessId]
  );
  return rows[0] || null;
};

const getClaseDelNegocio = async (claseId, businessId) => {
  const { rows } = await pool.query(
    'SELECT * FROM clases WHERE id = $1 AND business_id = $2',
    [claseId, businessId]
  );
  return rows[0] || null;
};

// ─── ADMIN: Listar clases de un tema ─────────────────────────────────────────
export const getClasesByModulo = async (req, res) => {
  const businessId = req.user?.bid;
  const { moduloId } = req.params;

  try {
    const modulo = await getModuloDelNegocio(moduloId, businessId);
    if (!modulo) return res.status(404).json({ ok: false, error: 'Tema no encontrado.' });

    const { rows } = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM modulo_pdfs mp WHERE mp.clase_id = c.id) AS total_pdfs
       FROM clases c
       WHERE c.modulo_id = $1
       ORDER BY c.orden ASC, c.created_at ASC`,
      [moduloId]
    );

    // Conteo de presentaciones por clase, aparte y defensivo: si la tabla
    // `clase_presentaciones` aún no existe (migración pendiente) no rompe el
    // listado de clases, solo deja total_presentaciones = 0.
    const ids = rows.map((r) => r.id);
    rows.forEach((r) => { r.total_presentaciones = 0; });
    if (ids.length) {
      try {
        const { rows: counts } = await pool.query(
          'SELECT clase_id, COUNT(*)::int AS n FROM clase_presentaciones WHERE clase_id = ANY($1) GROUP BY clase_id',
          [ids]
        );
        const map = new Map(counts.map((c) => [c.clase_id, c.n]));
        rows.forEach((r) => { r.total_presentaciones = map.get(r.id) || 0; });
      } catch (err) {
        if (err.code !== '42P01') throw err; // solo toleramos "tabla no existe"
      }
    }

    res.json({ ok: true, clases: rows });
  } catch (err) {
    console.error('getClasesByModulo:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener las clases.' });
  }
};

// ─── ADMIN: Detalle de una clase (con sus PDFs) ──────────────────────────────
export const getClaseById = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    const clase = await getClaseDelNegocio(id, businessId);
    if (!clase) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });

    const { rows: pdfs } = await pool.query(
      'SELECT id, nombre, pdf_url, orden FROM modulo_pdfs WHERE clase_id=$1 ORDER BY orden ASC, created_at ASC',
      [id]
    );
    const presentaciones = await fetchPresentacionesDeClase(id);
    res.json({ ok: true, clase, pdfs, presentaciones });
  } catch (err) {
    console.error('getClaseById:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener la clase.' });
  }
};

// ─── ADMIN: Crear clase dentro de un tema ────────────────────────────────────
export const createClase = async (req, res) => {
  const businessId = req.user?.bid;
  const { moduloId } = req.params;
  const { titulo, descripcion, video_url, orden = 0 } = req.body;

  if (!titulo) return res.status(400).json({ ok: false, error: 'El título es requerido.' });

  try {
    const modulo = await getModuloDelNegocio(moduloId, businessId);
    if (!modulo) return res.status(404).json({ ok: false, error: 'Tema no encontrado.' });

    const { rows } = await pool.query(
      `INSERT INTO clases (modulo_id, business_id, titulo, descripcion, video_url, orden)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [moduloId, businessId, titulo, descripcion || null, video_url || null, orden]
    );
    res.status(201).json({ ok: true, clase: rows[0] });
  } catch (err) {
    console.error('createClase:', err);
    res.status(500).json({ ok: false, error: 'Error al crear la clase.' });
  }
};

// ─── ADMIN: Actualizar clase ──────────────────────────────────────────────────
export const updateClase = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { titulo, descripcion, video_url, orden, activa } = req.body;

  try {
    const existente = await getClaseDelNegocio(id, businessId);
    if (!existente) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });

    // Si cambian el video a un enlace externo (o lo borran), eliminamos el archivo
    // que hubiera en GCS para no dejar basura huérfana.
    const nuevoVideoUrl = video_url !== undefined ? (video_url || null) : existente.video_url;
    let nuevoGcsPath = existente.video_gcs_path;
    if (existente.video_gcs_path && nuevoVideoUrl !== existente.video_url) {
      await deleteClaseVideoFromGCS(existente.video_gcs_path).catch(() => {});
      nuevoGcsPath = null;
    }

    const { rows } = await pool.query(
      `UPDATE clases
       SET titulo=$1, descripcion=$2, video_url=$3, video_gcs_path=$4,
           orden=$5, activa=$6, updated_at=NOW()
       WHERE id=$7 AND business_id=$8
       RETURNING *`,
      [
        titulo ?? existente.titulo,
        descripcion !== undefined ? (descripcion || null) : existente.descripcion,
        nuevoVideoUrl,
        nuevoGcsPath,
        orden ?? existente.orden,
        activa ?? existente.activa,
        id, businessId,
      ]
    );
    res.json({ ok: true, clase: rows[0] });
  } catch (err) {
    console.error('updateClase:', err);
    res.status(500).json({ ok: false, error: 'Error al actualizar la clase.' });
  }
};

// ─── ADMIN: Eliminar clase ─────────────────────────────────────────────────────
export const deleteClase = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    const clase = await getClaseDelNegocio(id, businessId);
    if (!clase) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });

    const { rows: pdfRows } = await pool.query(
      'SELECT gcs_path FROM modulo_pdfs WHERE clase_id=$1',
      [id]
    );
    await Promise.all(pdfRows.map((p) => deleteClasePdfFromGCS(p.gcs_path).catch(() => {})));

    const presRows = await pool
      .query('SELECT gcs_path FROM clase_presentaciones WHERE clase_id=$1', [id])
      .then((r) => r.rows)
      .catch((err) => { if (err.code === '42P01') return []; throw err; });
    await Promise.all(presRows.map((p) => deleteClasePresentacionFromGCS(p.gcs_path).catch(() => {})));

    if (clase.video_gcs_path) {
      await deleteClaseVideoFromGCS(clase.video_gcs_path).catch(() => {});
    }

    await pool.query('DELETE FROM clases WHERE id=$1 AND business_id=$2', [id, businessId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteClase:', err);
    res.status(500).json({ ok: false, error: 'Error al eliminar la clase.' });
  }
};

// ─── ADMIN: Subir la grabación (video) de la clase ───────────────────────────
export const uploadClaseVideo = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió ningún video.' });

  try {
    const clase = await getClaseDelNegocio(id, businessId);
    if (!clase) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });

    const { publicUrl, gcsPath } = await uploadClaseVideoToGCS(req.file.buffer, {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      claseId: id,
    });

    const { rows } = await pool.query(
      `UPDATE clases SET video_url=$1, video_gcs_path=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [publicUrl, gcsPath, id]
    );

    if (clase.video_gcs_path) {
      deleteClaseVideoFromGCS(clase.video_gcs_path).catch(() => {});
    }

    res.status(201).json({ ok: true, clase: rows[0] });
  } catch (err) {
    console.error('uploadClaseVideo:', err);
    res.status(500).json({ ok: false, error: 'Error al subir el video.' });
  }
};

// ─── ADMIN: Subir PDFs adjuntos a la clase ───────────────────────────────────
export const uploadPdfsClase = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  if (!req.files || !req.files.length) {
    return res.status(400).json({ ok: false, error: 'No se recibieron archivos PDF.' });
  }

  try {
    const clase = await getClaseDelNegocio(id, businessId);
    if (!clase) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });

    const insertados = [];
    for (const file of req.files) {
      const { publicUrl, gcsPath } = await uploadClasePdfToGCS(file.buffer, {
        filename: file.originalname,
        mimetype: file.mimetype,
        claseId: id,
      });
      const { rows } = await pool.query(
        `INSERT INTO modulo_pdfs (modulo_id, clase_id, nombre, pdf_url, gcs_path, business_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nombre, pdf_url, orden`,
        [clase.modulo_id, id, file.originalname, publicUrl, gcsPath, businessId]
      );
      insertados.push(rows[0]);
    }
    res.status(201).json({ ok: true, pdfs: insertados });
  } catch (err) {
    console.error('uploadPdfsClase:', err);
    res.status(500).json({ ok: false, error: 'Error al subir los PDFs.' });
  }
};

// ─── ADMIN: Subir presentaciones (PDF/PPTX/SVG) a la clase ───────────────────
export const uploadPresentacionesClase = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  if (!req.files || !req.files.length) {
    return res.status(400).json({ ok: false, error: 'No se recibió ninguna presentación.' });
  }

  try {
    const clase = await getClaseDelNegocio(id, businessId);
    if (!clase) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });

    // Continúa el orden a partir de las que ya existen.
    const { rows: ord } = await pool.query(
      'SELECT COALESCE(MAX(orden), -1) AS max FROM clase_presentaciones WHERE clase_id=$1',
      [id]
    );
    let orden = (ord[0]?.max ?? -1) + 1;

    const insertadas = [];
    for (const file of req.files) {
      const { publicUrl, gcsPath } = await uploadClasePresentacionToGCS(file.buffer, {
        filename: file.originalname,
        mimetype: file.mimetype,
        claseId: id,
      });
      const { rows } = await pool.query(
        `INSERT INTO clase_presentaciones (clase_id, modulo_id, business_id, nombre, tipo, url, gcs_path, orden)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, nombre, tipo, url, orden`,
        [id, clase.modulo_id, businessId, file.originalname, tipoPresentacion(file.originalname), publicUrl, gcsPath, orden++]
      );
      insertadas.push(rows[0]);
    }
    res.status(201).json({ ok: true, presentaciones: insertadas });
  } catch (err) {
    console.error('uploadPresentacionesClase:', err);
    res.status(500).json({ ok: false, error: 'Error al subir las presentaciones.' });
  }
};

// ─── ESTUDIANTE: Ver una clase (con su progreso y la siguiente clase) ────────
export const getClaseByIdEstudiante = async (req, res) => {
  const estudianteId = req.student?.id || null;
  const { id } = req.params;

  try {
    const { rows: claseRows } = await pool.query('SELECT * FROM clases WHERE id = $1', [id]);
    if (!claseRows.length) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });
    const clase = claseRows[0];

    if (estudianteId) {
      const { rows: acceso } = await pool.query(
        'SELECT 1 FROM estudiante_modulos WHERE modulo_id=$1 AND estudiante_id=$2',
        [clase.modulo_id, estudianteId]
      );
      if (!acceso.length) return res.status(403).json({ ok: false, error: 'Sin acceso a esta clase.' });
    }

    const { rows: pdfs } = await pool.query(
      'SELECT id, nombre, pdf_url, orden FROM modulo_pdfs WHERE clase_id=$1 ORDER BY orden ASC, created_at ASC',
      [id]
    );
    const presentaciones = await fetchPresentacionesDeClase(id);

    let estado = 'pendiente';
    if (estudianteId) {
      const { rows: progreso } = await pool.query(
        'SELECT estado FROM estudiante_clases WHERE clase_id=$1 AND estudiante_id=$2',
        [id, estudianteId]
      );
      if (progreso.length) estado = progreso[0].estado;
    }

    const { rows: siguiente } = await pool.query(
      `SELECT id FROM clases
       WHERE modulo_id=$1 AND activa=true AND (orden, id) > ($2, $3)
       ORDER BY orden ASC, id ASC LIMIT 1`,
      [clase.modulo_id, clase.orden, clase.id]
    );

    res.json({ ok: true, clase, pdfs, presentaciones, estado, siguienteClaseId: siguiente[0]?.id || null });
  } catch (err) {
    console.error('getClaseByIdEstudiante:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener la clase.' });
  }
};

// ─── ESTUDIANTE: Índice del curso (temas + clases con su estado) ─────────────
// Devuelve la estructura completa que alimenta el sidebar y la barra de progreso
// del reproductor de clase: los temas (modulos) de la misma materia a los que el
// estudiante tiene acceso, cada uno con sus clases y el estado de cada clase para
// este estudiante, más los contadores globales de avance.
export const getClaseOutlineEstudiante = async (req, res) => {
  const estudianteId = req.student?.id || null;
  const { id } = req.params;

  try {
    const { rows: baseRows } = await pool.query(
      `SELECT c.modulo_id, m.materia_id, mat.nombre AS materia_nombre
       FROM clases c
       JOIN modulos m ON m.id = c.modulo_id
       LEFT JOIN materias mat ON mat.id = m.materia_id
       WHERE c.id = $1`,
      [id]
    );
    if (!baseRows.length) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });
    const { modulo_id, materia_id, materia_nombre } = baseRows[0];

    // Temas del "curso": todos los de la misma materia (a los que el estudiante
    // tenga acceso); si el tema no pertenece a una materia, solo el tema actual.
    let temas;
    if (materia_id) {
      const params = [materia_id];
      let accesoFilter = '';
      if (estudianteId) {
        params.push(estudianteId);
        accesoFilter = `AND EXISTS (
          SELECT 1 FROM estudiante_modulos em
          WHERE em.modulo_id = m.id AND em.estudiante_id = $2
        )`;
      }
      const { rows } = await pool.query(
        `SELECT m.id, m.titulo, m.orden
         FROM modulos m
         WHERE m.materia_id = $1 AND m.activa = true ${accesoFilter}
         ORDER BY m.orden ASC, m.created_at ASC`,
        params
      );
      temas = rows;
    } else {
      const { rows } = await pool.query(
        'SELECT id, titulo, orden FROM modulos WHERE id = $1',
        [modulo_id]
      );
      temas = rows;
    }

    // Clases de cada tema con el estado (pendiente/completado) para este estudiante.
    let totalClases = 0;
    let completadas = 0;
    const temasConClases = await Promise.all(
      temas.map(async (tema) => {
        const { rows: clases } = await pool.query(
          `SELECT c.id, c.titulo, c.orden,
                  COALESCE(ec.estado, 'pendiente') AS estado
           FROM clases c
           LEFT JOIN estudiante_clases ec
             ON ec.clase_id = c.id AND ec.estudiante_id = $2
           WHERE c.modulo_id = $1 AND c.activa = true
           ORDER BY c.orden ASC, c.created_at ASC`,
          [tema.id, estudianteId]
        );
        totalClases += clases.length;
        completadas += clases.filter((c) => c.estado === 'completado').length;

        // Examen del tema (si tiene evaluación activa vinculada). Alimenta el
        // botón "Tomar examen" al final del tema en el índice del curso.
        const { rows: exRows } = await pool.query(
          `SELECT e.id AS evaluacion_id, e.titulo, e.descripcion,
                  ea.id AS asignacion_id,
                  COALESCE(ea.estado, 'pendiente') AS estado,
                  ea.calificacion
             FROM modulo_evaluaciones me
             JOIN evaluaciones e ON e.id = me.evaluacion_id AND e.activa = true
             LEFT JOIN evaluacion_asignaciones ea
               ON ea.evaluacion_id = e.id AND ea.estudiante_id = $2
            WHERE me.modulo_id = $1
            ORDER BY e.id ASC
            LIMIT 1`,
          [tema.id, estudianteId]
        );
        const examen = exRows[0] || null;

        return { ...tema, clases, examen };
      })
    );

    res.json({
      ok: true,
      materia: materia_id ? { id: materia_id, nombre: materia_nombre } : null,
      temas: temasConClases,
      totalClases,
      completadas,
    });
  } catch (err) {
    console.error('getClaseOutlineEstudiante:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener el índice del curso.' });
  }
};

// ─── ESTUDIANTE: Marcar una clase como completada ────────────────────────────
export const completarClase = async (req, res) => {
  const estudianteId = req.student?.id || null;
  const { id } = req.params;

  // Si quien mira es un admin (preview), no hay progreso real que guardar.
  if (!estudianteId) return res.json({ ok: true, skipped: true });

  try {
    const { rows: claseRows } = await pool.query('SELECT business_id FROM clases WHERE id=$1', [id]);
    if (!claseRows.length) return res.status(404).json({ ok: false, error: 'Clase no encontrada.' });

    await pool.query(
      `INSERT INTO estudiante_clases (clase_id, estudiante_id, business_id, estado, fecha_completado)
       VALUES ($1,$2,$3,'completado', NOW())
       ON CONFLICT (clase_id, estudiante_id)
       DO UPDATE SET estado='completado', fecha_completado=NOW()`,
      [id, estudianteId, claseRows[0].business_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('completarClase:', err);
    res.status(500).json({ ok: false, error: 'Error al marcar la clase como completada.' });
  }
};

// ─── ADMIN: Eliminar un PDF de la clase ──────────────────────────────────────
export const deletePdfDeClase = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, pdfId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT gcs_path FROM modulo_pdfs WHERE id=$1 AND clase_id=$2 AND business_id=$3',
      [pdfId, id, businessId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'PDF no encontrado.' });

    await deleteClasePdfFromGCS(rows[0].gcs_path).catch(() => {});
    await pool.query('DELETE FROM modulo_pdfs WHERE id=$1', [pdfId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('deletePdfDeClase:', err);
    res.status(500).json({ ok: false, error: 'Error al eliminar el PDF.' });
  }
};

// ─── ADMIN: Eliminar una presentación de la clase ────────────────────────────
export const deletePresentacionDeClase = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, presId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT gcs_path FROM clase_presentaciones WHERE id=$1 AND clase_id=$2 AND business_id=$3',
      [presId, id, businessId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Presentación no encontrada.' });

    await deleteClasePresentacionFromGCS(rows[0].gcs_path).catch(() => {});
    await pool.query('DELETE FROM clase_presentaciones WHERE id=$1', [presId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('deletePresentacionDeClase:', err);
    res.status(500).json({ ok: false, error: 'Error al eliminar la presentación.' });
  }
};

// ─── Proxy same-origin del archivo de una presentación ───────────────────────
// Sirve el archivo (streaming desde GCS) por el mismo origen del backend para que
// pdf.js pueda descargar el PDF y renderizarlo página por página sin toparse con
// CORS (el bucket de GCS no expone cabeceras CORS). Accesible por admin o
// estudiante (flexAuth) — el contenido ya es público vía su URL de GCS.
export const streamPresentacionFile = async (req, res) => {
  const { presId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT nombre, tipo, gcs_path FROM clase_presentaciones WHERE id=$1',
      [presId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Presentación no encontrada.' });

    const pres = rows[0];
    if (!pres.gcs_path) return res.status(404).json({ ok: false, message: 'Archivo no disponible.' });

    const contentType = pres.tipo === 'pdf'
      ? 'application/pdf'
      : pres.tipo === 'svg'
        ? 'image/svg+xml'
        : pres.tipo === 'html'
          ? 'text/html; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(pres.nombre || 'presentacion')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const stream = getClasePresentacionFile(pres.gcs_path).createReadStream();
    stream.on('error', (err) => {
      console.error('streamPresentacionFile stream:', err);
      if (!res.headersSent) res.status(500).json({ ok: false, message: 'Error al leer el archivo.' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    console.error('streamPresentacionFile:', err);
    res.status(500).json({ ok: false, message: 'Error al servir la presentación.' });
  }
};
