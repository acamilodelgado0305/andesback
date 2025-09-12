import pool from "../database.js";

// --- CREATE (AJUSTADO) ---
export const createMateria = async (req, res) => {
  // Obtenemos solo los campos que existen en tu tabla actual
  const { nombre, tipo_programa, docente_id } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: 'El campo "nombre" es obligatorio.' });
  }

  try {
    const query = `
      INSERT INTO "public"."materias" 
        (nombre, tipo_programa, docente_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [nombre, tipo_programa, docente_id];
    const result = await pool.query(query, values);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23503') {
        return res.status(400).json({ message: 'El "docente_id" proporcionado no existe.' });
    }
    console.error('Error al crear materia:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ALL) --- (Sin cambios, ya funciona)
export const getAllMaterias = async (req, res) => {
  try {
    const query = `
      SELECT m.*, d.nombre_completo AS docente_nombre
      FROM "public"."materias" m
      LEFT JOIN "public"."docentes" d ON m.docente_id = d.id
      ORDER BY m.id ASC;
    `;
    const result = await pool.query(query);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener materias:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ONE) --- (Sin cambios, ya funciona)
export const getMateriaById = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT m.*, d.nombre_completo AS docente_nombre
      FROM "public"."materias" m
      LEFT JOIN "public"."docentes" d ON m.docente_id = d.id
      WHERE m.id = $1;
    `;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener materia ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- UPDATE (AJUSTADO) ---
export const updateMateria = async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_programa, docente_id, activa } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: 'El campo "nombre" es obligatorio.' });
  }

  // Esta validación sigue siendo útil por si se envía un valor incorrecto
  if (activa !== undefined && typeof activa !== 'boolean') {
    return res.status(400).json({ message: 'El campo "activa" debe ser un valor booleano (true o false).' });
  }

  try {
    const query = `
      UPDATE "public"."materias" SET 
        nombre = $1, 
        tipo_programa = $2, 
        docente_id = $3,
        -- CAMBIO CLAVE: Usamos COALESCE.
        -- Si $4 (el valor de 'activa' del frontend) es NULL, mantiene el valor existente en la columna.
        activa = COALESCE($4, activa), 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `;
    const values = [nombre, tipo_programa, docente_id, activa, id];
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    // ... (el bloque catch no cambia)
    if (error.code === '23503') {
        return res.status(400).json({ message: 'El "docente_id" proporcionado no existe.' });
    }
    console.error(`Error al actualizar materia ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- DELETE --- (Sin cambios, ya funciona)
export const deleteMateria = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM "public"."materias" WHERE id = $1;';
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Materia con ID ${id} no encontrada.` });
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error(`Error al eliminar materia ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};