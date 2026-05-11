// src/controllers/modulosController.js
import pool from '../database.js';
import { uploadModuloPdfToGCS, deleteModuloPdfFromGCS } from '../services/gcsModuloPdfs.js';

// ─── ADMIN: Listar módulos del negocio ───────────────────────────────────────
export const getModulos = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) return res.status(403).json({ ok: false, error: 'Sin negocio.' });

  try {
    const { rows } = await pool.query(
      `SELECT m.*,
        p.nombre AS programa_nombre,
        mat.nombre AS materia_nombre,
        (SELECT COUNT(*) FROM modulo_evaluaciones me WHERE me.modulo_id = m.id) AS total_evaluaciones,
        (SELECT COUNT(*) FROM estudiante_modulos em WHERE em.modulo_id = m.id) AS total_estudiantes,
        (SELECT COUNT(*) FROM modulo_pdfs mp WHERE mp.modulo_id = m.id) AS total_pdfs
       FROM modulos m
       LEFT JOIN programas p ON p.id = m.programa_id
       LEFT JOIN materias mat ON mat.id = m.materia_id
       WHERE m.business_id = $1
       ORDER BY m.orden ASC, m.created_at DESC`,
      [businessId]
    );
    res.json({ ok: true, modulos: rows });
  } catch (err) {
    console.error('getModulos:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener módulos.' });
  }
};

// ─── ADMIN: Obtener módulo con evaluaciones, estudiantes y PDFs ──────────────
export const getModuloById = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    const { rows: modRows } = await pool.query(
      'SELECT * FROM modulos WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    if (!modRows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado.' });

    const { rows: pdfRows } = await pool.query(
      'SELECT id, nombre, pdf_url, gcs_path, orden FROM modulo_pdfs WHERE modulo_id=$1 ORDER BY orden ASC, created_at ASC',
      [id]
    );

    const { rows: evalRows } = await pool.query(
      `SELECT me.id AS link_id, me.es_requerida, e.id, e.titulo, e.descripcion, e.activa
       FROM modulo_evaluaciones me
       JOIN evaluaciones e ON e.id = me.evaluacion_id
       WHERE me.modulo_id = $1`,
      [id]
    );

    const { rows: estRows } = await pool.query(
      `SELECT em.id AS link_id, em.estado, em.whatsapp_enviado, em.fecha_asignacion,
              s.id, s.nombre, s.apellido, s.email, s.telefono_whatsapp
       FROM estudiante_modulos em
       JOIN students s ON s.id = em.estudiante_id
       WHERE em.modulo_id = $1 AND em.business_id = $2`,
      [id, businessId]
    );

    res.json({ ok: true, modulo: modRows[0], pdfs: pdfRows, evaluaciones: evalRows, estudiantes: estRows });
  } catch (err) {
    console.error('getModuloById:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener módulo.' });
  }
};

// ─── ADMIN: Crear módulo ──────────────────────────────────────────────────────
export const createModulo = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) return res.status(403).json({ ok: false, error: 'Sin negocio.' });

  const { titulo, descripcion, contenido, activa = true, orden = 0, programa_id, materia_id, evaluacion_id } = req.body;
  if (!titulo) return res.status(400).json({ ok: false, error: 'El título es requerido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Si viene materia_id, derivar el programa_id desde la materia para auto-asignar
    let effectiveProgramaId = programa_id || null;
    if (materia_id) {
      const { rows: matRows } = await client.query(
        'SELECT programa_id FROM materias WHERE id = $1 AND business_id = $2',
        [materia_id, businessId]
      );
      if (matRows.length && matRows[0].programa_id) {
        effectiveProgramaId = matRows[0].programa_id;
      }
    }

    const { rows } = await client.query(
      `INSERT INTO modulos (titulo, descripcion, contenido, activa, orden, programa_id, materia_id, business_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [titulo, descripcion || null, contenido || null, activa, orden,
       effectiveProgramaId || null, materia_id || null, businessId]
    );
    const modulo = rows[0];

    // Auto-asignar a TODOS los estudiantes del programa (derivado de la materia o directo)
    if (effectiveProgramaId) {
      const { rows: estudiantesPrograma } = await client.query(
        'SELECT estudiante_id FROM estudiante_programas WHERE programa_id = $1',
        [effectiveProgramaId]
      );

      if (estudiantesPrograma.length > 0) {
        const vals = estudiantesPrograma
          .map((e) => `(${modulo.id}, ${e.estudiante_id}, 'pendiente', ${businessId})`)
          .join(', ');
        await client.query(
          `INSERT INTO estudiante_modulos (modulo_id, estudiante_id, estado, business_id)
           VALUES ${vals}
           ON CONFLICT (modulo_id, estudiante_id) DO NOTHING`
        );
      }
    }

    // Vincular evaluación obligatoria si viene evaluacion_id
    if (evaluacion_id) {
      await client.query(
        `INSERT INTO modulo_evaluaciones (modulo_id, evaluacion_id, es_requerida)
         VALUES ($1, $2, true)
         ON CONFLICT (modulo_id, evaluacion_id) DO NOTHING`,
        [modulo.id, evaluacion_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, modulo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createModulo:', err);
    res.status(500).json({ ok: false, error: 'Error al crear módulo.' });
  } finally {
    client.release();
  }
};

// ─── ADMIN: Actualizar módulo ─────────────────────────────────────────────────
export const updateModulo = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { titulo, descripcion, contenido, activa, orden } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE modulos
       SET titulo=$1, descripcion=$2, contenido=$3, activa=$4, orden=$5, updated_at=NOW()
       WHERE id=$6 AND business_id=$7
       RETURNING *`,
      [titulo, descripcion || null, contenido || null, activa, orden ?? 0, id, businessId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado.' });
    res.json({ ok: true, modulo: rows[0] });
  } catch (err) {
    console.error('updateModulo:', err);
    res.status(500).json({ ok: false, error: 'Error al actualizar módulo.' });
  }
};

// ─── ADMIN: Eliminar módulo ───────────────────────────────────────────────────
export const deleteModulo = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    // Obtener y eliminar todos los PDFs de GCS antes de borrar el módulo
    const { rows: pdfRows } = await pool.query(
      'SELECT gcs_path FROM modulo_pdfs WHERE modulo_id=$1',
      [id]
    );
    for (const pdf of pdfRows) {
      await deleteModuloPdfFromGCS(pdf.gcs_path).catch((e) =>
        console.warn('[GCS] No se pudo eliminar PDF al borrar módulo:', e.message)
      );
    }

    const { rowCount } = await pool.query(
      'DELETE FROM modulos WHERE id=$1 AND business_id=$2',
      [id, businessId]
    );
    if (!rowCount) return res.status(404).json({ ok: false, error: 'Módulo no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteModulo:', err);
    res.status(500).json({ ok: false, error: 'Error al eliminar módulo.' });
  }
};

// ─── ADMIN: Subir uno o varios PDFs al módulo ────────────────────────────────
export const uploadPdfsModulo = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  if (!req.files || !req.files.length) {
    return res.status(400).json({ ok: false, error: 'No se recibieron archivos PDF.' });
  }

  try {
    // Verificar que el módulo pertenece al negocio
    const { rows } = await pool.query(
      'SELECT id FROM modulos WHERE id=$1 AND business_id=$2',
      [id, businessId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Módulo no encontrado.' });

    const insertados = [];

    for (const file of req.files) {
      const { publicUrl, gcsPath } = await uploadModuloPdfToGCS(file.buffer, {
        filename: file.originalname,
        mimetype: file.mimetype,
        moduloId: id,
      });

      const { rows: inserted } = await pool.query(
        `INSERT INTO modulo_pdfs (modulo_id, nombre, pdf_url, gcs_path, business_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, pdf_url, orden`,
        [id, file.originalname, publicUrl, gcsPath, businessId]
      );
      insertados.push(inserted[0]);
    }

    res.status(201).json({ ok: true, pdfs: insertados });
  } catch (err) {
    console.error('uploadPdfsModulo:', err);
    res.status(500).json({ ok: false, error: 'Error al subir los PDFs.' });
  }
};

// ─── ADMIN: Eliminar un PDF específico del módulo ────────────────────────────
export const deletePdfDeModulo = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, pdfId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT gcs_path FROM modulo_pdfs WHERE id=$1 AND modulo_id=$2 AND business_id=$3',
      [pdfId, id, businessId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'PDF no encontrado.' });

    await deleteModuloPdfFromGCS(rows[0].gcs_path).catch((e) =>
      console.warn('[GCS] No se pudo eliminar archivo:', e.message)
    );

    await pool.query('DELETE FROM modulo_pdfs WHERE id=$1', [pdfId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('deletePdfDeModulo:', err);
    res.status(500).json({ ok: false, error: 'Error al eliminar el PDF.' });
  }
};

// ─── ADMIN: Vincular evaluación a módulo ─────────────────────────────────────
export const addEvaluacionToModulo = async (req, res) => {
  const { id } = req.params;
  const { evaluacion_id, es_requerida = true } = req.body;
  if (!evaluacion_id) return res.status(400).json({ ok: false, error: 'evaluacion_id requerido.' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO modulo_evaluaciones (modulo_id, evaluacion_id, es_requerida)
       VALUES ($1,$2,$3)
       ON CONFLICT (modulo_id, evaluacion_id) DO UPDATE SET es_requerida = EXCLUDED.es_requerida
       RETURNING *`,
      [id, evaluacion_id, es_requerida]
    );
    res.status(201).json({ ok: true, link: rows[0] });
  } catch (err) {
    console.error('addEvaluacionToModulo:', err);
    res.status(500).json({ ok: false, error: 'Error al vincular evaluación.' });
  }
};

// ─── ADMIN: Desvincular evaluación de módulo ─────────────────────────────────
export const removeEvaluacionFromModulo = async (req, res) => {
  const { id, evalId } = req.params;

  try {
    await pool.query(
      'DELETE FROM modulo_evaluaciones WHERE modulo_id=$1 AND evaluacion_id=$2',
      [id, evalId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('removeEvaluacionFromModulo:', err);
    res.status(500).json({ ok: false, error: 'Error al desvincular evaluación.' });
  }
};

// ─── ADMIN: Asignar estudiantes a módulo ─────────────────────────────────────
export const asignarEstudiantes = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { estudiante_ids } = req.body;

  if (!Array.isArray(estudiante_ids) || !estudiante_ids.length) {
    return res.status(400).json({ ok: false, error: 'estudiante_ids debe ser un arreglo no vacío.' });
  }

  try {
    const values = estudiante_ids
      .map((eid) => `(${parseInt(id)}, ${parseInt(eid)}, 'pendiente', ${parseInt(businessId)})`)
      .join(', ');

    await pool.query(
      `INSERT INTO estudiante_modulos (modulo_id, estudiante_id, estado, business_id)
       VALUES ${values}
       ON CONFLICT (modulo_id, estudiante_id) DO NOTHING`
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('asignarEstudiantes:', err);
    res.status(500).json({ ok: false, error: 'Error al asignar estudiantes.' });
  }
};

// ─── ADMIN: Quitar estudiante de módulo ──────────────────────────────────────
export const quitarEstudiante = async (req, res) => {
  const { id, estId } = req.params;

  try {
    await pool.query(
      'DELETE FROM estudiante_modulos WHERE modulo_id=$1 AND estudiante_id=$2',
      [id, estId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('quitarEstudiante:', err);
    res.status(500).json({ ok: false, error: 'Error al quitar estudiante.' });
  }
};

// ─── ADMIN: Marcar WhatsApp como enviado ─────────────────────────────────────
export const marcarWhatsappEnviado = async (req, res) => {
  const { id, estId } = req.params;

  try {
    await pool.query(
      'UPDATE estudiante_modulos SET whatsapp_enviado=true WHERE modulo_id=$1 AND estudiante_id=$2',
      [id, estId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('marcarWhatsappEnviado:', err);
    res.status(500).json({ ok: false, error: 'Error al actualizar estado de WhatsApp.' });
  }
};

// ─── ESTUDIANTE: Ver mis módulos (flexAuth) ───────────────────────────────────
export const getModulosDeEstudiante = async (req, res) => {
  const estudianteId = req.student?.id || req.user?.id;
  if (!estudianteId) return res.status(401).json({ ok: false, error: 'No autenticado.' });

  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.titulo, m.descripcion, m.contenido, m.orden,
              em.estado, em.fecha_asignacion,
              (SELECT COUNT(*) FROM modulo_evaluaciones me WHERE me.modulo_id = m.id) AS total_evaluaciones,
              (SELECT COUNT(*) FROM modulo_pdfs mp WHERE mp.modulo_id = m.id) AS total_pdfs
       FROM estudiante_modulos em
       JOIN modulos m ON m.id = em.modulo_id
       WHERE em.estudiante_id = $1 AND m.activa = true
       ORDER BY m.orden ASC, m.created_at DESC`,
      [estudianteId]
    );
    res.json({ ok: true, modulos: rows });
  } catch (err) {
    console.error('getModulosDeEstudiante:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener módulos.' });
  }
};

// ─── ESTUDIANTE: Ver detalle de un módulo ────────────────────────────────────
export const getModuloDetalleEstudiante = async (req, res) => {
  const estudianteId = req.student?.id || req.user?.id;
  const { id } = req.params;
  if (!estudianteId) return res.status(401).json({ ok: false, error: 'No autenticado.' });

  try {
    const { rows: acceso } = await pool.query(
      'SELECT estado FROM estudiante_modulos WHERE modulo_id=$1 AND estudiante_id=$2',
      [id, estudianteId]
    );
    if (!acceso.length) return res.status(403).json({ ok: false, error: 'Sin acceso a este módulo.' });

    const { rows: modRows } = await pool.query(
      'SELECT id, titulo, descripcion, contenido FROM modulos WHERE id=$1 AND activa=true',
      [id]
    );
    if (!modRows.length) return res.status(404).json({ ok: false, error: 'Módulo no disponible.' });

    const { rows: pdfRows } = await pool.query(
      'SELECT id, nombre, pdf_url, orden FROM modulo_pdfs WHERE modulo_id=$1 ORDER BY orden ASC, created_at ASC',
      [id]
    );

    const { rows: evalRows } = await pool.query(
      `SELECT me.es_requerida, e.id, e.titulo, e.descripcion,
              ea.estado AS estado_asignacion, ea.id AS asignacion_id, ea.calificacion
       FROM modulo_evaluaciones me
       JOIN evaluaciones e ON e.id = me.evaluacion_id
       LEFT JOIN evaluacion_asignaciones ea ON ea.evaluacion_id = e.id AND ea.estudiante_id = $2
       WHERE me.modulo_id = $1 AND e.activa = true`,
      [id, estudianteId]
    );

    res.json({
      ok: true,
      modulo: modRows[0],
      pdfs: pdfRows,
      evaluaciones: evalRows,
      estado: acceso[0].estado,
    });
  } catch (err) {
    console.error('getModuloDetalleEstudiante:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener módulo.' });
  }
};
