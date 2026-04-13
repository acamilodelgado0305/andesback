import pool from "../database.js";

const DAYS_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// --- CREATE slot ---
export const createHorario = async (req, res) => {
  const { materia_id, dia_semana, hora_inicio, hora_fin, aula } = req.body;
  const businessId = req.user?.bid;

  if (!materia_id || !dia_semana || !hora_inicio || !hora_fin) {
    return res.status(400).json({ message: 'materia_id, dia_semana, hora_inicio y hora_fin son obligatorios.' });
  }
  if (!businessId) {
    return res.status(403).json({ message: 'No se pudo determinar el negocio del usuario.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO horarios (materia_id, dia_semana, hora_inicio, hora_fin, aula, business_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
      [materia_id, dia_semana, hora_inicio, hora_fin, aula || null, businessId]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear horario:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- GET slots by materia ---
export const getHorariosByMateria = async (req, res) => {
  const { materia_id } = req.query;
  const businessId = req.user?.bid;

  if (!businessId) return res.status(403).json({ message: 'No se pudo determinar el negocio.' });
  if (!materia_id) return res.status(400).json({ message: 'materia_id es requerido.' });

  try {
    const result = await pool.query(
      `SELECT h.*,
              m.nombre AS materia_nombre,
              COUNT(eh.estudiante_id)::int AS total_estudiantes
       FROM horarios h
       LEFT JOIN materias m ON m.id = h.materia_id
       LEFT JOIN estudiante_horarios eh ON eh.horario_id = h.id
       WHERE h.materia_id = $1 AND h.business_id = $2
       GROUP BY h.id, m.nombre
       ORDER BY ARRAY_POSITION($3::text[], h.dia_semana), h.hora_inicio;`,
      [materia_id, businessId, DAYS_ORDER]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener horarios de materia:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- GET full schedule for a student ---
// Ruta pública: el estudianteId actúa como identificador.
// El business_id se deriva del propio registro del estudiante en la DB.
// Obtiene automáticamente los horarios de todas las materias
// de los programas en que está inscrito el estudiante.
export const getHorariosByEstudiante = async (req, res) => {
  const { estudianteId } = req.params;

  if (!estudianteId || isNaN(estudianteId)) {
    return res.status(400).json({ message: 'estudianteId inválido.' });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM (
         SELECT DISTINCT
                h.id              AS horario_id,
                h.dia_semana,
                h.hora_inicio,
                h.hora_fin,
                h.aula,
                m.id              AS materia_id,
                m.nombre          AS materia_nombre,
                p.id              AS programa_id,
                p.nombre          AS programa_nombre,
                d.nombre_completo AS docente_nombre
         FROM estudiante_programas ep
         JOIN programas  p  ON p.id  = ep.programa_id
         JOIN materias   m  ON m.programa_id = p.id
         JOIN horarios   h  ON h.materia_id  = m.id
         LEFT JOIN docentes d ON d.id = m.docente_id
         WHERE ep.estudiante_id = $1
           AND h.business_id = (
             SELECT business_id FROM students WHERE id = $1 LIMIT 1
           )
           AND m.activa IS DISTINCT FROM false
       ) sub
       ORDER BY ARRAY_POSITION($2::text[], sub.dia_semana), sub.hora_inicio;`,
      [estudianteId, DAYS_ORDER]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener horario del estudiante:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- UPDATE slot ---
export const updateHorario = async (req, res) => {
  const { id } = req.params;
  const { dia_semana, hora_inicio, hora_fin, aula } = req.body;
  const businessId = req.user?.bid;

  if (!businessId) return res.status(403).json({ message: 'No se pudo determinar el negocio.' });

  try {
    const result = await pool.query(
      `UPDATE horarios SET
         dia_semana = COALESCE($1, dia_semana),
         hora_inicio = COALESCE($2, hora_inicio),
         hora_fin = COALESCE($3, hora_fin),
         aula = COALESCE($4, aula),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND business_id = $6
       RETURNING *;`,
      [dia_semana || null, hora_inicio || null, hora_fin || null, aula ?? null, id, businessId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Horario no encontrado.' });
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar horario:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- DELETE slot ---
export const deleteHorario = async (req, res) => {
  const { id } = req.params;
  const businessId = req.user?.bid;

  if (!businessId) return res.status(403).json({ message: 'No se pudo determinar el negocio.' });

  try {
    const result = await pool.query(
      'DELETE FROM horarios WHERE id = $1 AND business_id = $2;',
      [id, businessId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Horario no encontrado.' });
    return res.sendStatus(204);
  } catch (error) {
    console.error('Error al eliminar horario:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- GET students assigned to a slot ---
export const getEstudiantesDeHorario = async (req, res) => {
  const { id } = req.params;
  const businessId = req.user?.bid;

  if (!businessId) return res.status(403).json({ message: 'No se pudo determinar el negocio.' });

  try {
    const result = await pool.query(
      `SELECT s.id, s.nombre, s.apellido, s.numero_documento, s.telefono_whatsapp
       FROM estudiante_horarios eh
       JOIN students s ON s.id = eh.estudiante_id
       WHERE eh.horario_id = $1 AND eh.business_id = $2
       ORDER BY s.apellido, s.nombre;`,
      [id, businessId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener estudiantes del horario:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- ASSIGN students to a slot ---
// Body: { estudiante_ids: [1, 2, 3] }
export const asignarEstudiantes = async (req, res) => {
  const { id: horario_id } = req.params;
  const { estudiante_ids } = req.body;
  const businessId = req.user?.bid;

  if (!Array.isArray(estudiante_ids) || estudiante_ids.length === 0) {
    return res.status(400).json({ message: 'Debe enviar al menos un estudiante_id.' });
  }
  if (!businessId) return res.status(403).json({ message: 'No se pudo determinar el negocio.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inserted = 0;
    for (const estudianteId of estudiante_ids) {
      const r = await client.query(
        `INSERT INTO estudiante_horarios (estudiante_id, horario_id, business_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (estudiante_id, horario_id) DO NOTHING;`,
        [estudianteId, horario_id, businessId]
      );
      inserted += r.rowCount;
    }
    await client.query('COMMIT');
    return res.status(200).json({ message: `${inserted} estudiante(s) asignado(s).` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al asignar estudiantes:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

// --- REMOVE student from a slot ---
export const desasignarEstudiante = async (req, res) => {
  const { id: horario_id, estudianteId } = req.params;
  const businessId = req.user?.bid;

  if (!businessId) return res.status(403).json({ message: 'No se pudo determinar el negocio.' });

  try {
    const result = await pool.query(
      'DELETE FROM estudiante_horarios WHERE horario_id = $1 AND estudiante_id = $2 AND business_id = $3;',
      [horario_id, estudianteId, businessId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Asignación no encontrada.' });
    return res.sendStatus(204);
  } catch (error) {
    console.error('Error al desasignar estudiante:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
