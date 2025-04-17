import express from 'express';
import {
  createStudentController,
  getStudentsController,
  getStudentByIdController,
  updateStudentController,
  deleteStudentController,
  updateEstadoStudentController,
  getStudentsByBachilleratoController
} from '../controllers/studentController.js';

import { getGradesByStudentIdController } from '../controllers/GradesController.js';

import { uploadStudentsController } from "../controllers/uploadStudentsController.js"
import upload from "../uploadMiddleware.js"
const router = express.Router();

// Rutas para manejar estudiantes
router.post('/students', createStudentController); // Crear un nuevo estudiante
router.get('/students/bachillerato', getStudentsByBachilleratoController); // Crear un nuevo estudiante
router.get('/students', getStudentsController); // Obtener todos los estudiantes
router.get('/students/:id', getStudentByIdController); // Obtener un estudiante por su ID
router.get('/grades/students/:id', getGradesByStudentIdController); // Obtener un estudiante por su ID
router.put('/students/:id', updateStudentController); // Actualizar un estudiante por su ID
router.delete('/students/:id', deleteStudentController); // Eliminar un estudiante por su ID
router.put('/students/status_matricula/:id', updateEstadoStudentController);
router.post('/upload-students', upload.single('file'), uploadStudentsController);

export default router; 
