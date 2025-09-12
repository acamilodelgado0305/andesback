import pool from '../database.js'; // Asegúrate de que esta ruta sea correcta


// --- CREATE ---
/**
 * @description Crea un nuevo docente.
 */
export const createDocente = async (req, res) => {
  const { nombre_completo, email, especialidad } = req.body;

  if (!nombre_completo || !email) {
    return res.status(400).json({ message: 'El nombre completo y el email son obligatorios.' });
  }

  try {
    const query = `
      INSERT INTO "public"."docentes" (nombre_completo, email, especialidad)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query(query, [nombre_completo, email, especialidad]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: `El email '${email}' ya existe.` });
    }
    console.error('Error al crear docente:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ALL) ---
/**
 * @description Obtiene todos los docentes de la base de datos.
 */
export const getAllDocentes = async (req, res) => {
  try {
    const query = 'SELECT * FROM "public"."docentes" ORDER BY id ASC;';
    const result = await pool.query(query);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener docentes:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ONE) ---
/**
 * @description Obtiene un solo docente por su ID.
 */
export const getDocenteById = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'SELECT * FROM "public"."docentes" WHERE id = $1;';
    const result = await pool.query(query, [id]);

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
/**
 * @description Actualiza la información de un docente existente.
 */
export const updateDocente = async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, email, especialidad } = req.body;

  if (!nombre_completo || !email) {
    return res.status(400).json({ message: 'El nombre completo y el email son obligatorios.' });
  }

  try {
    const query = `
      UPDATE "public"."docentes"
      SET 
        nombre_completo = $1, 
        email = $2, 
        especialidad = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        id = $4
      RETURNING *;
    `;
    const result = await pool.query(query, [nombre_completo, email, especialidad, id]);

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
/**
 * @description Elimina un docente de la base de datos.
 */
export const deleteDocente = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM "public"."docentes" WHERE id = $1;';
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    
    // El código 204 "No Content" es el estándar para una eliminación exitosa.
    return res.sendStatus(204); 
  } catch (error) {
    console.error(`Error al eliminar docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};