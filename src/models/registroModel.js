import pool from '../database.js';

// Crear un estudiante
const createUserReg = async (
  nombre,
  apellido,
  email,
  tipoDocumento,
  numeroDocumento,
  lugarExpedicion,
  fechaNacimiento,
  lugarNacimiento,
  telefonoLlamadas,
  telefonoWhatsapp,
  eps,
  rh,
  nombreAcudiente,
  tipoDocumentoAcudiente,
  telefonoAcudiente,
  direccionAcudiente,
  simat,
  estadoMatricula,
  coordinador,
  programa_id
) => {
  const result = await pool.query(
    `INSERT INTO students 
      (nombre, apellido, email, tipo_documento, numero_documento, lugar_expedicion, fecha_nacimiento, lugar_nacimiento, 
       telefono_llamadas, telefono_whatsapp, eps, rh, nombre_acudiente, tipo_documento_acudiente, 
       telefono_acudiente, direccion_acudiente, simat, estado_matricula, coordinador, programa_id, fecha_inscripcion, activo) 
     VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, true) 
     RETURNING *`,
    [
      nombre,
      apellido,
      email,
      tipoDocumento,
      numeroDocumento,
      lugarExpedicion,
      fechaNacimiento,
      lugarNacimiento,
      telefonoLlamadas,
      telefonoWhatsapp,
      eps,
      rh,
      nombreAcudiente,
      tipoDocumentoAcudiente,
      telefonoAcudiente,
      direccionAcudiente,
      simat,
      estadoMatricula,
      coordinador,
      programa_id
    ]
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
const updateUserReg = async (
  id,
  nombre,
  apellido,
  email,
  tipoDocumento,
  numeroDocumento,
  lugarExpedicion,
  fechaNacimiento,
  lugarNacimiento,
  telefonoLlamadas,
  telefonoWhatsapp,
  eps,
  rh,
  nombreAcudiente,
  tipoDocumentoAcudiente,
  telefonoAcudiente,
  direccionAcudiente,
  simat,
  estadoMatricula,
  coordinador,
  programa_id,
  activo
) => {
  const result = await pool.query(
    `UPDATE students 
     SET nombre = $1, apellido = $2, email = $3, tipo_documento = $4, numero_documento = $5, lugar_expedicion = $6, 
         fecha_nacimiento = $7, lugar_nacimiento = $8, telefono_llamadas = $9, telefono_whatsapp = $10, 
         eps = $11, rh = $12, nombre_acudiente = $13, tipo_documento_acudiente = $14, telefono_acudiente = $15, 
         direccion_acudiente = $16, simat = $17, estado_matricula = $18, coordinador = $19, programa_id = $20, 
         activo = $21, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $22 
     RETURNING *`,
    [
      nombre,
      apellido,
      email,
      tipoDocumento,
      numeroDocumento,
      lugarExpedicion,
      fechaNacimiento,
      lugarNacimiento,
      telefonoLlamadas,
      telefonoWhatsapp,
      eps,
      rh,
      nombreAcudiente,
      tipoDocumentoAcudiente,
      telefonoAcudiente,
      direccionAcudiente,
      simat,
      estadoMatricula,
      coordinador,
      programa_id,
      activo,
      id
    ]
  );
  return result.rows[0];
};

// Eliminar un estudiante
const deleteUserReg = async (id) => {
  const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

export { createUserReg, getUsersReg, getUserReg, updateUserReg, deleteUserReg };
