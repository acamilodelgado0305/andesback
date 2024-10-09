// routes/subjectRoutes.js
import express from 'express';
import {
  createSubjectController,
  getSubjectsController,
  getSubjectByIdController,
  updateSubjectController,
  deleteSubjectController
} from '../controllers/subjectController.js';

const router = express.Router();

// Rutas para manejar materias
router.post('/subjects', createSubjectController); // Crear una nueva materia
router.get('/subjects', getSubjectsController); // Obtener todas las materias
router.get('/subjects/:id', getSubjectByIdController); // Obtener una materia por su ID
router.put('/subjects/:id', updateSubjectController); // Actualizar una materia por su ID
router.delete('/subjects/:id', deleteSubjectController); // Eliminar una materia por su ID

export default router;
