import pool from "../database.js";
import { uploadMateriaBannerToGCS, deleteMateriaBannerFromGCS } from "../services/gcsMateriaBanner.js";

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
