// models/subjectModel.js
import pool from '../database.js';

// Crear una materia
const createSubject = async (nombre, codigo, descripcion, program_id) => {
  const result = await pool.query(
    'INSERT INTO materias (nombre, codigo,  descripcion, program_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [nombre, codigo, descripcion, program_id]
  );
  return result.rows[0];
};

// Obtener todas las materias
const getSubjects = async () => {
  const result = await pool.query('SELECT * FROM materias');
  return result.rows;
};

// Obtener una materia por ID
const getSubjectById = async (id) => {
  const result = await pool.query('SELECT * FROM materias WHERE id = $1', [id]);
  return result.rows[0];
};

// Actualizar una materia
const updateSubject = async (id, nombre, codigo, descripcion, program_id) => {
  const result = await pool.query(
    'UPDATE materias SET nombre = $1, codigo = $2, descripcion = $3, program_id = $4 WHERE id = $5 RETURNING *',
    [nombre, codigo, descripcion, program_id, id]
  );
  return result.rows[0];
};


// Eliminar una materia
const deleteSubject = async (id) => {
  const result = await pool.query('DELETE FROM materias WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

export { createSubject, getSubjects, getSubjectById, updateSubject, deleteSubject };
