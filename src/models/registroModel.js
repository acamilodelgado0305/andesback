import pool from '../database.js';

// Crear un estudiante
const createUserReg = async (nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, ultimoCursoVisto, numeroCedula, modalidadEstudio) => {
  const result = await pool.query(
    `INSERT INTO students 
      (nombre, apellido, email, telefono, fecha_nacimiento, programa_id, coordinador, fecha_inscripcion, activo, ultimo_curso_visto, numero_cedula, modalidad_estudio) 
     VALUES 
      ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, true, $8, $9, $10) 
     RETURNING *`,
    [nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, ultimoCursoVisto, numeroCedula, modalidadEstudio]
  );
  return result.rows[0];
};

// Obtener todos los estudiantes
const getUsersReg = async () => {
  const result = await pool.query('SELECT * FROM students');
  return result.rows;
};

// Obtener un estudiante por ID
const getUserReg = async (id) => {
  const result = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
  return result.rows[0];
};

// Actualizar un estudiante
const updateUserReg = async (id, nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, ultimoCursoVisto, numeroCedula, modalidadEstudio, activo) => {
  const result = await pool.query(
    `UPDATE students 
     SET nombre = $1, apellido = $2, email = $3, telefono = $4, fecha_nacimiento = $5, programa_id = $6, coordinador = $7, ultimo_curso_visto = $8, numero_cedula = $9, modalidad_estudio = $10, activo = $11, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $12 
     RETURNING *`,
    [nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, ultimoCursoVisto, numeroCedula, modalidadEstudio, activo, id]
  );
  return result.rows[0];
};

// Eliminar un estudiante
const deleteUserReg = async (id) => {
  const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

export { createUserReg, getUsersReg, getUserReg, updateUserReg, deleteUserReg };
