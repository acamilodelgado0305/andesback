// models/programModel.js
import pool from '../database.js';

// Crear un programa
const createProgram = async (nombre, monto) => {
  const result = await pool.query(
    'INSERT INTO programas (nombre, monto) VALUES ($1, $2) RETURNING *',
    [nombre, monto]
  );
  return result.rows[0];
};

// Obtener todos los programas
const getPrograms = async () => {
  const result = await pool.query('SELECT * FROM programas');
  return result.rows;
};

// Obtener un programa por ID
const getProgramById = async (id) => {
  const result = await pool.query('SELECT * FROM programas WHERE id = $1', [id]);
  return result.rows[0];
};

// Actualizar un programa
const updateProgram = async (id, nombre, monto) => {
  const result = await pool.query(
    'UPDATE programas SET nombre = $1, monto = $2 WHERE id = $3 RETURNING *',
    [nombre, monto, id]
  );
  return result.rows[0];
};

// Eliminar un programa
const deleteProgram = async (id) => {
  const result = await pool.query('DELETE FROM programas WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

export { createProgram, getPrograms, getProgramById, updateProgram, deleteProgram };
