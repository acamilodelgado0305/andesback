import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { flexAuthMiddleware } from '../middlewares/flexAuthMiddleware.js';
import {
  createHorario,
  getHorariosByMateria,
  getHorariosByEstudiante,
  updateHorario,
  deleteHorario,
  getEstudiantesDeHorario,
  asignarEstudiantes,
  desasignarEstudiante,
} from '../controllers/horariosController.js';

const router = Router();

// Ruta estudiante: acepta token admin O token estudiante
router.get('/horarios/estudiante/:estudianteId', flexAuthMiddleware, getHorariosByEstudiante);


// Todas las demás rutas requieren autenticación admin
router.get('/horarios', authMiddleware, getHorariosByMateria);
router.post('/horarios', authMiddleware, createHorario);
router.put('/horarios/:id', authMiddleware, updateHorario);
router.delete('/horarios/:id', authMiddleware, deleteHorario);

// Estudiantes en un slot
router.get('/horarios/:id/estudiantes', authMiddleware, getEstudiantesDeHorario);
router.post('/horarios/:id/estudiantes', authMiddleware, asignarEstudiantes);
router.delete('/horarios/:id/estudiantes/:estudianteId', authMiddleware, desasignarEstudiante);

export default router;
