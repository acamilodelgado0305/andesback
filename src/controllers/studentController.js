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
    horarioEstudio,
    eps,
    rh,
    nombreAcudiente,
    tipoDocumentoAcudiente,
    telefonoAcudiente,
    direccionAcudiente,
    simat,
    estadoMatricula,
    mensualidadMes
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO students 
        (nombre, apellido, email, tipo_documento, numero_documento, lugar_expedicion, fecha_nacimiento, lugar_nacimiento, 
         telefono_llamadas, telefono_whatsapp, horario_estudio, eps, rh, nombre_acudiente, tipo_documento_acudiente, 
         telefono_acudiente, direccion_acudiente, simat, estado_matricula, mensualidad_mes, fecha_inscripcion, activo) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP, true) 
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
        horarioEstudio,
        eps,
        rh,
        nombreAcudiente,
        tipoDocumentoAcudiente,
        telefonoAcudiente,
        direccionAcudiente,
        simat,
        estadoMatricula,
        mensualidadMes
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
    horarioEstudio,
    eps,
    rh,
    nombreAcudiente,
    tipoDocumentoAcudiente,
    telefonoAcudiente,
    direccionAcudiente,
    simat,
    estadoMatricula,
    mensualidadMes,
    activo
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE students 
       SET nombre = $1, apellido = $2, email = $3, tipo_documento = $4, numero_documento = $5, lugar_expedicion = $6, 
           fecha_nacimiento = $7, lugar_nacimiento = $8, telefono_llamadas = $9, telefono_whatsapp = $10, horario_estudio = $11, 
           eps = $12, rh = $13, nombre_acudiente = $14, tipo_documento_acudiente = $15, telefono_acudiente = $16, 
           direccion_acudiente = $17, simat = $18, estado_matricula = $19, mensualidad_mes = $20, activo = $21, updated_at = CURRENT_TIMESTAMP 
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
        horarioEstudio,
        eps,
        rh,
        nombreAcudiente,
        tipoDocumentoAcudiente,
        telefonoAcudiente,
        direccionAcudiente,
        simat,
        estadoMatricula,
        mensualidadMes,
        activo,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando estudiante', err);
    res.status(500).json({ error: 'Error actualizando estudiante' });
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
  const { estado_matricula, mensualidad_mes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE students 
       SET estado_matricula = $1, mensualidad_mes = $2
       WHERE id = $3 
       RETURNING *`,
      [estado_matricula, mensualidad_mes, id]
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
