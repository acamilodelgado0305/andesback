import pool from "../database.js";

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
