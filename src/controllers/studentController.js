import pool from '../database.js';

const createStudentController = async (req, res) => {
  const {
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
    programa_id,
    coordinador,
    modalidad_estudio, // Nuevo campo
  } = req.body;

  if (!programa_id) {
    return res.status(400).json({ error: 'El campo programa_id es obligatorio' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO students 
        (nombre, apellido, email, tipo_documento, numero_documento, lugar_expedicion, fecha_nacimiento, lugar_nacimiento, 
         telefono_llamadas, telefono_whatsapp, eps, rh, nombre_acudiente, tipo_documento_acudiente, 
         telefono_acudiente, direccion_acudiente, simat, estado_matricula, programa_id, coordinador, modalidad_estudio, 
         fecha_inscripcion, activo) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, true) 
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
        programa_id,
        coordinador,
        modalidad_estudio, // Nuevo valor agregado al array
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creando estudiante', err);
    res.status(500).json({ error: 'Error creando estudiante' });
  }
};


const getStudentsController = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error obteniendo estudiantes', err);
    res.status(500).json({ error: 'Error obteniendo estudiantes' });
  }
};

const getStudentByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo estudiante', err);
    res.status(500).json({ error: 'Error obteniendo estudiante' });
  }
};

const updateStudentController = async (req, res) => {
  const { id } = req.params;
  const {
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
    programa_id,
    coordinador,
    activo,
    modalidad_estudio, // Nuevo campo agregado
    ultimo_curso_visto // Campo recientemente agregado
  } = req.body;

  // Validación del ID
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID de estudiante inválido' });
  }

  // Validaciones básicas de campos requeridos
  if (!nombre || !apellido || !email || !tipoDocumento || !numeroDocumento) {
    return res.status(400).json({
      error: 'Los campos nombre, apellido, email, tipo de documento y número de documento son obligatorios'
    });
  }

  // Validación básica de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Formato de email inválido' });
  }

  try {
    // Primero verificamos si el estudiante existe
    const existingStudent = await pool.query(
      'SELECT * FROM students WHERE id = $1',
      [id]
    );

    if (existingStudent.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Verificamos si el email ya está en uso por otro estudiante
    const emailCheck = await pool.query(
      'SELECT * FROM students WHERE email = $1 AND id != $2',
      [email, id]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está en uso por otro estudiante' });
    }

    const result = await pool.query(
      `UPDATE students 
       SET nombre = $1, 
           apellido = $2, 
           email = $3, 
           tipo_documento = $4, 
           numero_documento = $5, 
           lugar_expedicion = $6, 
           fecha_nacimiento = $7, 
           lugar_nacimiento = $8, 
           telefono_llamadas = $9, 
           telefono_whatsapp = $10, 
           eps = $11, 
           rh = $12, 
           nombre_acudiente = $13, 
           tipo_documento_acudiente = $14, 
           telefono_acudiente = $15, 
           direccion_acudiente = $16, 
           simat = $17, 
           estado_matricula = $18, 
           programa_id = $19,
           coordinador = $20,
           activo = $21,
           modalidad_estudio = $22, 
           ultimo_curso_visto = $23, -- Nuevo campo agregado
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $24 
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
        programa_id,
        coordinador,
        activo,
        modalidad_estudio, // Nuevo valor
        ultimo_curso_visto, // Nuevo valor
        id
      ]
    );

    res.status(200).json({
      mensaje: 'Estudiante actualizado exitosamente',
      estudiante: result.rows[0]
    });
  } catch (err) {
    console.error('Error actualizando estudiante:', err);
    res.status(500).json({
      error: 'Error interno del servidor al actualizar el estudiante',
      detalles: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};



const deleteStudentController = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error eliminando estudiante', err);
    res.status(500).json({ error: 'Error eliminando estudiante' });
  }
};

const updateEstadoStudentController = async (req, res) => {
  const { id } = req.params;
  const { estado_matricula } = req.body;
  try {
    const result = await pool.query(
      `UPDATE students 
       SET estado_matricula = $1
       WHERE id = $2 
       RETURNING *`,
      [estado_matricula, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando estado de estudiante', err);
    res.status(500).json({ error: 'Error actualizando estado de estudiante' });
  }
};

export {
  createStudentController,
  getStudentsController,
  getStudentByIdController,
  updateStudentController,
  deleteStudentController,
  updateEstadoStudentController
};
