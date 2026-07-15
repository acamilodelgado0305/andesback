import pool from "../database.js";
import { uploadMateriaBannerToGCS, deleteMateriaBannerFromGCS } from "../services/gcsMateriaBanner.js";
import {
  copyMateriaBanner, copyModuloPdf, copyClaseVideo, copyClasePdf, copyClasePresentacion,
} from "../services/gcsCopy.js";

// --- CREATE ---
export const createMateria = async (req, res) => {
  const { nombre, programa_id, docente_id } = req.body;
  const businessId = req.user?.bid;

  if (!nombre) {
    return res.status(400).json({ message: 'El campo "nombre" es obligatorio.' });
  }
  if (!programa_id) {
    return res.status(400).json({ message: 'El campo "programa_id" es obligatorio.' });
  }
  if (!businessId) {
    return res.status(403).json({ message: 'No se pudo determinar el negocio del usuario.' });
  }

  try {
    const query = `
      INSERT INTO "public"."materias"
        (nombre, programa_id, docente_id, business_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query(query, [nombre, programa_id, docente_id || null, businessId]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23503') {
      const field = error.constraint?.includes('docente') ? 'docente_id' : 'programa_id';
      return res.status(400).json({ message: `El "${field}" proporcionado no existe.` });
    }
    console.error('Error al crear materia:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ALL) ---
export const getAllMaterias = async (req, res) => {
  const businessId = req.user?.bid;
  const { programa_id } = req.query;

  if (!businessId) {
    return res.status(403).json({ message: 'No se pudo determinar el negocio del usuario.' });
  }

  try {
    const conditions = ['m.business_id = $1'];
    const values = [businessId];
    let idx = 2;

    if (programa_id) {
      conditions.push(`m.programa_id = $${idx++}`);
      values.push(programa_id);
    }

    const query = `
      SELECT
        m.*,
        p.nombre AS programa_nombre,
        p.tipo_programa,
        d.nombre_completo AS docente_nombre
      FROM "public"."materias" m
      LEFT JOIN "public"."programas" p ON m.programa_id = p.id
      LEFT JOIN "public"."docentes" d ON m.docente_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.nombre ASC, m.nombre ASC;
    `;
    const result = await pool.query(query, values);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener materias:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ONE) ---
export const getMateriaById = async (req, res) => {
  const { id } = req.params;
  const businessId = req.user?.bid;

  if (!businessId) {
    return res.status(403).json({ message: 'No se pudo determinar el negocio del usuario.' });
  }

  try {
    const query = `
      SELECT
        m.*,
        p.nombre AS programa_nombre,
        p.tipo_programa,
        d.nombre_completo AS docente_nombre
      FROM "public"."materias" m
      LEFT JOIN "public"."programas" p ON m.programa_id = p.id
      LEFT JOIN "public"."docentes" d ON m.docente_id = d.id
      WHERE m.id = $1 AND m.business_id = $2;
    `;
    const result = await pool.query(query, [id, businessId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener materia ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- DETALLE (materia + docente + programa + contadores) ---
// flexAuth: admin (scopeado por business_id) o el propio estudiante inscrito
// en el programa de la materia (para reusar este panel como el "dashboard de
// materia" del portal de estudiante, en modo solo-lectura).
export const getMateriaDetalle = async (req, res) => {
  const { id } = req.params;
  const businessId = req.user?.bid;
  const estudianteId = req.student?.id;

  if (!businessId && !estudianteId) {
    return res.status(403).json({ message: 'No autorizado.' });
  }

  try {
    const scopeCondition = businessId ? 'm.business_id = $2' : `EXISTS (
        SELECT 1 FROM "public"."estudiante_programas" ep
        WHERE ep.estudiante_id = $2 AND ep.programa_id = m.programa_id
      )`;

    const query = `
      SELECT
        m.*,
        p.nombre        AS programa_nombre,
        p.tipo_programa,
        d.nombre_completo AS docente_nombre,
        (SELECT COUNT(*) FROM "public"."modulos"            md WHERE md.materia_id = m.id) AS total_temas,
        (SELECT COUNT(*) FROM "public"."evaluaciones"       e  WHERE e.materia_id  = m.id) AS total_evaluaciones,
        (SELECT COUNT(*) FROM "public"."materia_foro_posts" f  WHERE f.materia_id  = m.id) AS total_posts
      FROM "public"."materias" m
      LEFT JOIN "public"."programas" p ON m.programa_id = p.id
      LEFT JOIN "public"."docentes"  d ON m.docente_id  = d.id
      WHERE m.id = $1 AND ${scopeCondition};
    `;
    const result = await pool.query(query, [id, businessId || estudianteId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener detalle de materia ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- MATERIAS DE UN ESTUDIANTE (flexAuth: admin o el propio estudiante) ---
// Devuelve las materias de los programas en los que está inscrito el estudiante.
// Se usa para el foro del portal del estudiante.
export const getMateriasDeEstudiante = async (req, res) => {
  const { estudianteId } = req.params;

  // El estudiante solo puede ver lo suyo; el admin puede consultar cualquiera
  if (req.student && Number(req.student.id) !== Number(estudianteId)) {
    return res.status(403).json({ message: 'No autorizado.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT m.id, m.nombre, m.programa_id,
              p.nombre AS programa_nombre,
              d.nombre_completo AS docente_nombre
         FROM estudiante_programas ep
         JOIN materias m  ON m.programa_id = ep.programa_id
         LEFT JOIN programas p ON p.id = m.programa_id
         LEFT JOIN docentes  d ON d.id = m.docente_id
        WHERE ep.estudiante_id = $1 AND m.activa = true
        ORDER BY p.nombre ASC, m.nombre ASC`,
      [estudianteId]
    );
    return res.status(200).json({ ok: true, materias: rows });
  } catch (error) {
    console.error('Error en getMateriasDeEstudiante:', error);
    return res.status(500).json({ ok: false, message: 'Error al obtener las materias del estudiante.' });
  }
};

// --- PROGRESO DE UN ESTUDIANTE EN LA MATERIA (flexAuth) ---
// El curso está "completado" cuando el estudiante aprobó el examen de TODOS los
// temas de la materia (mismo número de exámenes aprobados que de temas). Se usa
// para la página de felicitaciones y para poder recargarla/compartirla sin
// depender del estado de navegación.
export const getMateriaProgresoEstudiante = async (req, res) => {
  const estudianteId = req.student?.id || null;
  const { id } = req.params;
  if (!estudianteId) return res.status(401).json({ ok: false, error: 'No autenticado.' });

  try {
    const { rows: matRows } = await pool.query(
      `SELECT m.id, m.nombre, p.nombre AS programa_nombre
       FROM materias m
       LEFT JOIN programas p ON p.id = m.programa_id
       WHERE m.id = $1`,
      [id]
    );
    if (!matRows.length) return res.status(404).json({ ok: false, error: 'Materia no encontrada.' });

    const { rows: progRows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM modulos md WHERE md.materia_id = $1 AND md.activa = true) AS total_temas,
         (SELECT COUNT(*) FROM modulos md
            JOIN estudiante_modulos em
              ON em.modulo_id = md.id AND em.estudiante_id = $2 AND em.estado = 'completado'
          WHERE md.materia_id = $1 AND md.activa = true) AS temas_completados`,
      [id, estudianteId]
    );
    const totalTemas = Number(progRows[0].total_temas);
    const temasCompletados = Number(progRows[0].temas_completados);

    // Progreso a nivel CLASE: todas las clases de los temas accesibles, en orden
    // continuo, con su estado. Sirve para el botón "Iniciar / Continuar · Clase N".
    const { rows: claseRows } = await pool.query(
      `SELECT c.id AS clase_id, c.titulo, m.id AS modulo_id,
              COALESCE(ec.estado, 'pendiente') AS estado
       FROM modulos m
       JOIN clases c ON c.modulo_id = m.id AND c.activa = true
       LEFT JOIN estudiante_clases ec ON ec.clase_id = c.id AND ec.estudiante_id = $2
       WHERE m.materia_id = $1 AND m.activa = true
         AND EXISTS (
           SELECT 1 FROM estudiante_modulos em
           WHERE em.modulo_id = m.id AND em.estudiante_id = $2
         )
       ORDER BY m.orden ASC, m.created_at ASC, c.orden ASC, c.created_at ASC`,
      [id, estudianteId]
    );

    const totalClases = claseRows.length;
    let clasesCompletadas = 0;
    let siguienteClase = null; // primera clase pendiente (donde continuar)
    claseRows.forEach((row, idx) => {
      if (row.estado === 'completado') {
        clasesCompletadas += 1;
      } else if (!siguienteClase) {
        siguienteClase = { id: row.clase_id, numero: idx + 1, titulo: row.titulo, moduloId: row.modulo_id };
      }
    });
    const primeraClaseId = claseRows[0]?.clase_id || null;

    res.json({
      ok: true,
      materia: {
        id: matRows[0].id,
        nombre: matRows[0].nombre,
        programaNombre: matRows[0].programa_nombre,
      },
      totalTemas,
      temasCompletados,
      completado: totalTemas > 0 && totalTemas === temasCompletados,
      // Nivel clase (para el botón de iniciar/continuar en el dashboard):
      totalClases,
      clasesCompletadas,
      iniciada: clasesCompletadas > 0,
      clasesTodasCompletadas: totalClases > 0 && clasesCompletadas === totalClases,
      siguienteClase, // null si ya completó todas las clases
      primeraClaseId,
    });
  } catch (err) {
    console.error('getMateriaProgresoEstudiante:', err);
    res.status(500).json({ ok: false, error: 'Error al obtener el progreso de la materia.' });
  }
};

// --- UPDATE ---
export const updateMateria = async (req, res) => {
  const { id } = req.params;
  const { nombre, programa_id, docente_id, activa } = req.body;
  const businessId = req.user?.bid;

  if (!nombre) {
    return res.status(400).json({ message: 'El campo "nombre" es obligatorio.' });
  }
  if (!programa_id) {
    return res.status(400).json({ message: 'El campo "programa_id" es obligatorio.' });
  }
  if (!businessId) {
    return res.status(403).json({ message: 'No se pudo determinar el negocio del usuario.' });
  }
  if (activa !== undefined && typeof activa !== 'boolean') {
    return res.status(400).json({ message: 'El campo "activa" debe ser un valor booleano.' });
  }

  try {
    const query = `
      UPDATE "public"."materias" SET
        nombre = $1,
        programa_id = $2,
        docente_id = $3,
        activa = COALESCE($4, activa),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND business_id = $6
      RETURNING *;
    `;
    const result = await pool.query(query, [
      nombre, programa_id, docente_id || null, activa ?? null, id, businessId
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23503') {
      const field = error.constraint?.includes('docente') ? 'docente_id' : 'programa_id';
      return res.status(400).json({ message: `El "${field}" proporcionado no existe.` });
    }
    console.error(`Error al actualizar materia ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- DELETE ---
export const deleteMateria = async (req, res) => {
  const { id } = req.params;
  const businessId = req.user?.bid;

  if (!businessId) {
    return res.status(403).json({ message: 'No se pudo determinar el negocio del usuario.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM "public"."materias" WHERE id = $1 AND business_id = $2;',
      [id, businessId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error(`Error al eliminar materia ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- UPLOAD BANNER ---
export const uploadMateriaBanner = async (req, res) => {
  const { id } = req.params;
  const businessId = req.user?.bid;

  if (!businessId) {
    return res.status(403).json({ message: 'No se pudo determinar el negocio del usuario.' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'No se recibió ninguna imagen.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT banner_gcs_path FROM materias WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }

    const { publicUrl, gcsPath } = await uploadMateriaBannerToGCS(req.file.buffer, {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      materiaId: id,
    });

    const result = await pool.query(
      `UPDATE "public"."materias" SET banner_url = $1, banner_gcs_path = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *;`,
      [publicUrl, gcsPath, id]
    );

    const anterior = rows[0].banner_gcs_path;
    if (anterior) {
      deleteMateriaBannerFromGCS(anterior).catch(() => {});
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al subir el banner de la materia ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- DUPLICAR (copia profunda en otro programa) ---
// Clona la materia y TODA su estructura en el programa destino: temas (modulos),
// clases (con video), PDFs, presentaciones y evaluaciones (con preguntas/opciones)
// + los links tema→evaluación. Los archivos de GCS se copian físicamente (copia
// server-side) para que la materia duplicada sea 100% independiente de la original.
// NO se copian estudiantes, progreso, asignaciones ni foro: los estudiantes del
// programa destino reciben el contenido por la auto-asignación perezosa existente
// (getModulosDeEstudiante / getEvaluacionesDeEstudiante).
export const duplicarMateria = async (req, res) => {
  const { id } = req.params;
  const businessId = req.user?.bid;
  const { programa_id_destino, nombre } = req.body;

  if (!businessId) {
    return res.status(403).json({ message: 'No se pudo determinar el negocio del usuario.' });
  }
  if (!programa_id_destino) {
    return res.status(400).json({ message: 'El campo "programa_id_destino" es obligatorio.' });
  }

  const client = await pool.connect();
  try {
    // Materia origen (scopeada por negocio)
    const { rows: matRows } = await client.query(
      'SELECT * FROM "public"."materias" WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );
    if (!matRows.length) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }
    const origen = matRows[0];

    // Programa destino (debe pertenecer al mismo negocio)
    const { rows: progRows } = await client.query(
      'SELECT id FROM "public"."programas" WHERE id = $1 AND business_id = $2',
      [programa_id_destino, businessId]
    );
    if (!progRows.length) {
      return res.status(400).json({ message: 'El programa destino no existe o no pertenece a tu negocio.' });
    }

    // Copia un archivo de GCS si tiene gcs_path; si es un enlace externo (solo url)
    // lo referencia tal cual. Si la copia falla, cae a referenciar la url original
    // (best-effort: la duplicación no se aborta por un archivo).
    const dupFile = async ({ gcsPath, url }, copyFn, ...args) => {
      if (gcsPath) {
        try {
          const copied = await copyFn(gcsPath, ...args);
          if (copied) return copied;
        } catch (e) {
          console.warn('[duplicarMateria] Falló copia GCS, se comparte el archivo original:', e.message);
        }
        // Fallback: si la copia falla, se COMPARTE el archivo original (mismo
        // gcs_path/url) en vez de devolver null. Algunas tablas (p. ej. modulo_pdfs)
        // tienen gcs_path NOT NULL: insertar null abortaría TODA la transacción de
        // duplicado (y la materia quedaría "vacía", solo con el nombre).
        return { publicUrl: url || null, gcsPath };
      }
      // Sin gcs_path → enlace externo (YouTube/Loom/...) o vacío: se comparte la url.
      return { publicUrl: url || null, gcsPath: null };
    };

    await client.query('BEGIN');

    // 1. Nueva materia
    const { rows: nuevaMatRows } = await client.query(
      `INSERT INTO "public"."materias" (nombre, programa_id, docente_id, business_id, activa)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre?.trim() || origen.nombre, programa_id_destino, origen.docente_id, businessId, origen.activa]
    );
    const nuevaMateria = nuevaMatRows[0];

    // 2. Banner (best-effort)
    if (origen.banner_gcs_path) {
      const b = await dupFile(
        { gcsPath: origen.banner_gcs_path, url: origen.banner_url },
        copyMateriaBanner, nuevaMateria.id, origen.banner_url
      );
      await client.query(
        'UPDATE "public"."materias" SET banner_url = $1, banner_gcs_path = $2 WHERE id = $3',
        [b.publicUrl, b.gcsPath, nuevaMateria.id]
      );
      nuevaMateria.banner_url = b.publicUrl;
      nuevaMateria.banner_gcs_path = b.gcsPath;
    }

    // 3. Evaluaciones de la materia (por materia_id o vinculadas a sus temas)
    const { rows: evalRows } = await client.query(
      `SELECT DISTINCT e.*
         FROM "public"."evaluaciones" e
        WHERE e.business_id = $2 AND (
          e.materia_id = $1
          OR e.id IN (
            SELECT me.evaluacion_id FROM "public"."modulo_evaluaciones" me
            JOIN "public"."modulos" m ON m.id = me.modulo_id
            WHERE m.materia_id = $1
          )
        )`,
      [id, businessId]
    );

    const evalMap = new Map(); // srcEvalId → newEvalId
    for (const ev of evalRows) {
      const { rows: nuevaEvalRows } = await client.query(
        `INSERT INTO "public"."evaluaciones"
           (titulo, descripcion, tipo_destino, programa_id, materia_id, fecha_inicio, fecha_fin,
            intentos_max, tiempo_limite_min, activa, business_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [ev.titulo, ev.descripcion, ev.tipo_destino, programa_id_destino, nuevaMateria.id,
         ev.fecha_inicio, ev.fecha_fin, ev.intentos_max, ev.tiempo_limite_min, ev.activa, businessId]
      );
      const newEvalId = nuevaEvalRows[0].id;
      evalMap.set(ev.id, newEvalId);

      await client.query(
        `INSERT INTO "public"."evaluacion_programas" (evaluacion_id, programa_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [newEvalId, programa_id_destino]
      );

      // Preguntas + opciones
      const { rows: preguntas } = await client.query(
        'SELECT * FROM "public"."evaluacion_preguntas" WHERE evaluacion_id = $1 ORDER BY orden ASC, id ASC',
        [ev.id]
      );
      for (const p of preguntas) {
        const { rows: nuevaPregRows } = await client.query(
          `INSERT INTO "public"."evaluacion_preguntas"
             (evaluacion_id, enunciado, tipo_pregunta, es_obligatoria, puntaje, orden)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [newEvalId, p.enunciado, p.tipo_pregunta, p.es_obligatoria, p.puntaje, p.orden]
        );
        const newPregId = nuevaPregRows[0].id;
        const { rows: opciones } = await client.query(
          'SELECT * FROM "public"."evaluacion_opciones" WHERE pregunta_id = $1 ORDER BY orden ASC, id ASC',
          [p.id]
        );
        for (const o of opciones) {
          await client.query(
            `INSERT INTO "public"."evaluacion_opciones" (pregunta_id, texto, es_correcta, orden)
             VALUES ($1,$2,$3,$4)`,
            [newPregId, o.texto, o.es_correcta, o.orden]
          );
        }
      }
    }

    // 4. Temas (modulos) + clases + pdfs + presentaciones + links de evaluación
    const { rows: modulos } = await client.query(
      'SELECT * FROM "public"."modulos" WHERE materia_id = $1 AND business_id = $2 ORDER BY orden ASC, created_at ASC',
      [id, businessId]
    );

    for (const m of modulos) {
      const { rows: nuevoModRows } = await client.query(
        `INSERT INTO "public"."modulos"
           (titulo, descripcion, contenido, activa, orden, programa_id, materia_id, business_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [m.titulo, m.descripcion, m.contenido, m.activa, m.orden, programa_id_destino, nuevaMateria.id, businessId]
      );
      const newModuloId = nuevoModRows[0].id;

      // 4a. Clases del tema (cada una con su video, PDFs y presentaciones)
      const { rows: clases } = await client.query(
        'SELECT * FROM "public"."clases" WHERE modulo_id = $1 ORDER BY orden ASC, created_at ASC',
        [m.id]
      );
      for (const c of clases) {
        const { rows: nuevaClaseRows } = await client.query(
          `INSERT INTO "public"."clases" (modulo_id, business_id, titulo, descripcion, orden, activa)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [newModuloId, businessId, c.titulo, c.descripcion, c.orden, c.activa]
        );
        const newClaseId = nuevaClaseRows[0].id;

        // Video (GCS → copia física; enlace externo → se comparte)
        if (c.video_url || c.video_gcs_path) {
          const vid = await dupFile(
            { gcsPath: c.video_gcs_path, url: c.video_url },
            copyClaseVideo, newClaseId, c.video_url
          );
          await client.query(
            'UPDATE "public"."clases" SET video_url = $1, video_gcs_path = $2 WHERE id = $3',
            [vid.publicUrl, vid.gcsPath, newClaseId]
          );
        }

        // PDFs de la clase
        const { rows: clasePdfs } = await client.query(
          'SELECT * FROM "public"."modulo_pdfs" WHERE clase_id = $1 ORDER BY orden ASC, created_at ASC',
          [c.id]
        );
        for (const pdf of clasePdfs) {
          const copied = await dupFile({ gcsPath: pdf.gcs_path, url: pdf.pdf_url }, copyClasePdf, newClaseId, pdf.nombre);
          // modulo_pdfs.pdf_url y gcs_path son NOT NULL: si la copia no devolvió
          // valores se referencian los del PDF original para no romper el INSERT.
          await client.query(
            `INSERT INTO "public"."modulo_pdfs" (modulo_id, clase_id, nombre, pdf_url, gcs_path, orden, business_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [newModuloId, newClaseId, pdf.nombre, copied.publicUrl ?? pdf.pdf_url, copied.gcsPath ?? pdf.gcs_path, pdf.orden, businessId]
          );
        }

        // Presentaciones de la clase (tolerar que la tabla aún no exista → migración pendiente)
        try {
          const { rows: pres } = await client.query(
            'SELECT * FROM "public"."clase_presentaciones" WHERE clase_id = $1 ORDER BY orden ASC, created_at ASC',
            [c.id]
          );
          for (const pr of pres) {
            const copied = await dupFile({ gcsPath: pr.gcs_path, url: pr.url }, copyClasePresentacion, newClaseId, pr.nombre);
            await client.query(
              `INSERT INTO "public"."clase_presentaciones" (clase_id, modulo_id, business_id, nombre, tipo, url, gcs_path, orden)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [newClaseId, newModuloId, businessId, pr.nombre, pr.tipo, copied.publicUrl, copied.gcsPath, pr.orden]
            );
          }
        } catch (e) {
          if (e.code !== '42P01') throw e;
        }
      }

      // 4b. PDFs a nivel tema (clase_id IS NULL, "legacy")
      const { rows: temaPdfs } = await client.query(
        'SELECT * FROM "public"."modulo_pdfs" WHERE modulo_id = $1 AND clase_id IS NULL ORDER BY orden ASC, created_at ASC',
        [m.id]
      );
      for (const pdf of temaPdfs) {
        const copied = await dupFile({ gcsPath: pdf.gcs_path, url: pdf.pdf_url }, copyModuloPdf, newModuloId, pdf.nombre);
        // modulo_pdfs.pdf_url y gcs_path son NOT NULL (ver nota arriba).
        await client.query(
          `INSERT INTO "public"."modulo_pdfs" (modulo_id, clase_id, nombre, pdf_url, gcs_path, orden, business_id)
           VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
          [newModuloId, pdf.nombre, copied.publicUrl ?? pdf.pdf_url, copied.gcsPath ?? pdf.gcs_path, pdf.orden, businessId]
        );
      }

      // 4c. Links tema → evaluación (mapeando al nuevo id de evaluación)
      const { rows: modEvals } = await client.query(
        'SELECT * FROM "public"."modulo_evaluaciones" WHERE modulo_id = $1',
        [m.id]
      );
      for (const me of modEvals) {
        const newEvalId = evalMap.get(me.evaluacion_id);
        if (!newEvalId) continue;
        await client.query(
          `INSERT INTO "public"."modulo_evaluaciones" (modulo_id, evaluacion_id, es_requerida)
           VALUES ($1,$2,$3) ON CONFLICT (modulo_id, evaluacion_id) DO NOTHING`,
          [newModuloId, newEvalId, me.es_requerida]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({ ok: true, materia: nuevaMateria });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al duplicar materia:', error);
    return res.status(500).json({ message: 'Error interno al duplicar la materia.' });
  } finally {
    client.release();
  }
};
