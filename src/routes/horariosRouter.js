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
router.use(authMiddleware);

// Slots de una materia
router.get('/horarios', getHorariosByMateria);                              // ?materia_id=X
router.post('/horarios', createHorario);
router.put('/horarios/:id', updateHorario);
router.delete('/horarios/:id', deleteHorario);

// Estudiantes en un slot
router.get('/horarios/:id/estudiantes', getEstudiantesDeHorario);
router.post('/horarios/:id/estudiantes', asignarEstudiantes);
router.delete('/horarios/:id/estudiantes/:estudianteId', desasignarEstudiante);

export default router;
