import pool from '../database.js';

const createStudentController = async (req, res) => {
  const { 
    nombre, 
    apellido, 
    email, 
    telefono, 
    fechaNacimiento, 
    programaId, 
    coordinador, 
    ultimoCursoVisto, 
    numeroCedula, 
    modalidadEstudio,
    fechaGraduacion 
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO students 
        (nombre, apellido, email, telefono, fecha_nacimiento, programa_id, coordinador, 
         fecha_inscripcion, activo, ultimo_curso_visto, numero_cedula, modalidad_estudio, fecha_graduacion) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, true, $8, $9, $10, $11) 
       RETURNING *`,
      [nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, 
       ultimoCursoVisto, numeroCedula, modalidadEstudio, fechaGraduacion]
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
    telefono, 
    fechaNacimiento, 
    programaId, 
    coordinador, 
    ultimoCursoVisto, 
    numeroCedula, 
    modalidadEstudio, 
    activo 
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE students 
       SET nombre = $1, apellido = $2, email = $3, telefono = $4, fecha_nacimiento = $5, 
           programa_id = $6, coordinador = $7, ultimo_curso_visto = $8, numero_cedula = $9, 
           modalidad_estudio = $10, activo = $11, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $12 
       RETURNING *`,
      [nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, 
       ultimoCursoVisto, numeroCedula, modalidadEstudio, activo, id]
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