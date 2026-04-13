import pool from '../database.js';

// --- CREATE ---
export const createDocente = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) {
    return res.status(400).json({ message: 'Token sin business asociado.' });
  }

  const { nombre_completo, email, especialidad } = req.body;
  if (!nombre_completo || !email) {
    return res.status(400).json({ message: 'El nombre completo y el email son obligatorios.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO docentes (nombre_completo, email, especialidad, business_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [nombre_completo, email, especialidad || null, businessId]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: `El email '${email}' ya existe en este negocio.` });
    }
    console.error('Error al crear docente:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ALL) ---
export const getAllDocentes = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) {
    return res.status(400).json({ message: 'Token sin business asociado.' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM docentes WHERE business_id = $1 ORDER BY nombre_completo ASC;`,
      [businessId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener docentes:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ONE) ---
export const getDocenteById = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM docentes WHERE id = $1 AND business_id = $2;`,
      [id, businessId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- UPDATE ---
export const updateDocente = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { nombre_completo, email, especialidad } = req.body;

  if (!nombre_completo || !email) {
    return res.status(400).json({ message: 'El nombre completo y el email son obligatorios.' });
  }

  try {
    const result = await pool.query(
      `UPDATE docentes
       SET nombre_completo = $1,
           email           = $2,
           especialidad    = $3,
           updated_at      = CURRENT_TIMESTAMP
       WHERE id = $4 AND business_id = $5
       RETURNING *;`,
      [nombre_completo, email, especialidad || null, id, businessId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: `El email '${email}' ya está en uso por otro docente.` });
    }
    console.error(`Error al actualizar docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- DELETE ---
export const deleteDocente = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM docentes WHERE id = $1 AND business_id = $2;`,
      [id, businessId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error(`Error al eliminar docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
