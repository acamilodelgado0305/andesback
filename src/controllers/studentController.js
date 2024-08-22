import {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent
} from '../models/studentModel.js';

const createStudentController = async (req, res) => {
  const { nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, ultimoCursoVisto, numeroCedula, modalidadEstudio,fechaGraduacion } = req.body;
  try {
    const student = await createStudent(nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, ultimoCursoVisto, numeroCedula, modalidadEstudio,fechaGraduacion);
    res.status(201).json(student);
  } catch (err) {
    console.error('Error creando estudiante', err);
    res.status(500).json({ error: 'Error creando estudiante' });
  }
};

const getStudentsController = async (req, res) => {
  try {
    const students = await getStudents();
    res.status(200).json(students);
  } catch (err) {
    console.error('Error obteniendo estudiantes', err);
    res.status(500).json({ error: 'Error obteniendo estudiantes' });
  }
};

const getStudentByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const student = await getStudentById(id);
    if (!student) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(student);
  } catch (err) {
    console.error('Error obteniendo estudiante', err);
    res.status(500).json({ error: 'Error obteniendo estudiante' });
  }
};

const updateStudentController = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, ultimoCursoVisto, numeroCedula, modalidadEstudio, activo } = req.body;
  try {
    const student = await updateStudent(id, nombre, apellido, email, telefono, fechaNacimiento, programaId, coordinador, ultimoCursoVisto, numeroCedula, modalidadEstudio, activo);
    if (!student) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(student);
  } catch (err) {
    console.error('Error actualizando estudiante', err);
    res.status(500).json({ error: 'Error actualizando estudiante' });
  }
};

const deleteStudentController = async (req, res) => {
  const { id } = req.params;
  try {
    const student = await deleteStudent(id);
    if (!student) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.status(200).json(student);
  } catch (err) {
    console.error('Error eliminando estudiante', err);
    res.status(500).json({ error: 'Error eliminando estudiante' });
  }
};

export {
  createStudentController,
  getStudentsController,
  getStudentByIdController,
  updateStudentController,
  deleteStudentController
};
