// controllers/clientController.js
import Student from "../models/student.js"

// Crear un nuevo estudiante
export const createStudent = async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Obtener todos los estudiantes
export const getStudents = async (req, res) => {
  try {
    const students = await Student.find()
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener un estudiante por ID
export const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('facturas');
    if (!student) return res.status(404).json({ message: 'Estudiante no encontrado' });
    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Actualizar un estudiante por ID
export const updateStudent = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!client) return res.status(404).json({ message: 'Estudiante no encontrado' });
    res.status(200).json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar un estudiante por ID
export const deleteStudent = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Estudiante no encontrado' });
    res.status(200).json({ message: 'Estudiante eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


