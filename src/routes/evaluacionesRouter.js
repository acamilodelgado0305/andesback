// src/routes/evaluacionesRouter.js
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { flexAuthMiddleware } from '../middlewares/flexAuthMiddleware.js';
import {
  createEvaluacion,
  getEvaluaciones,
  getEvaluacionById,
  updateEvaluacion,
  deleteEvaluacion,
  addPreguntaConOpciones,
  updatePregunta,
  deletePregunta,
  addOpcion,
  updateOpcion,
  deleteOpcion,
  asignarPorProgramaPrincipal,
  asignarPorEstudianteProgramas,
  asignarAEstudiantesSeleccionados,
  getAsignacionesDeEvaluacion,
  removeAsignacion,
  getEvaluacionesDeEstudiante,
  getAsignacionDetalleParaResponder,
  responderEvaluacion,
} from '../controllers/evaluationController.js';

const router = express.Router();

// =================== RUTAS PARA ESTUDIANTES (acepta token admin O token estudiante) ===================

router.get('/evaluaciones/estudiantes/:estudianteId/asignaciones', flexAuthMiddleware, getEvaluacionesDeEstudiante);
router.get('/evaluaciones/asignaciones/:asignacionId', flexAuthMiddleware, getAsignacionDetalleParaResponder);
router.post('/evaluaciones/asignaciones/:asignacionId/respuestas', flexAuthMiddleware, responderEvaluacion);


// =================== RUTAS ADMIN (requieren authMiddleware) ===================

router.use(authMiddleware);

// CRUD Evaluaciones
router.get('/evaluaciones', getEvaluaciones);
router.get('/evaluaciones/evaluaciones/:id', getEvaluacionById);
router.post('/evaluaciones', createEvaluacion);
router.put('/evaluaciones/:id', updateEvaluacion);
router.delete('/evaluaciones/:id', deleteEvaluacion);

// Asignaciones
router.get('/evaluaciones/:id/asignaciones', getAsignacionesDeEvaluacion);
router.delete('/evaluaciones/:id/asignaciones/:estudianteId', removeAsignacion);
router.post('/evaluaciones/:id/asignar/programa-principal', asignarPorProgramaPrincipal);
router.post('/evaluaciones/:id/asignar/estudiante-programas', asignarPorEstudianteProgramas);
router.post('/evaluaciones/:id/asignar/estudiantes', asignarAEstudiantesSeleccionados);

// Preguntas y opciones
router.post('/evaluaciones/:id/preguntas', addPreguntaConOpciones);
router.put('/evaluaciones/preguntas/:preguntaId', updatePregunta);
router.delete('/preguntas/:preguntaId', deletePregunta);
router.post('/evaluaciones/preguntas/:preguntaId/opciones', addOpcion);
router.put('/evaluaciones/opciones/:opcionId', updateOpcion);
router.delete('/evaluaciones/opciones/:opcionId', deleteOpcion);

export default router;
