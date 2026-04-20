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

// CRUD Evaluaciones
router.get('/evaluaciones', authMiddleware, getEvaluaciones);
router.get('/evaluaciones/evaluaciones/:id', authMiddleware, getEvaluacionById);
router.post('/evaluaciones', authMiddleware, createEvaluacion);
router.put('/evaluaciones/:id', authMiddleware, updateEvaluacion);
router.delete('/evaluaciones/:id', authMiddleware, deleteEvaluacion);

// Asignaciones
router.get('/evaluaciones/:id/asignaciones', authMiddleware, getAsignacionesDeEvaluacion);
router.delete('/evaluaciones/:id/asignaciones/:estudianteId', authMiddleware, removeAsignacion);
router.post('/evaluaciones/:id/asignar/programa-principal', authMiddleware, asignarPorProgramaPrincipal);
router.post('/evaluaciones/:id/asignar/estudiante-programas', authMiddleware, asignarPorEstudianteProgramas);
router.post('/evaluaciones/:id/asignar/estudiantes', authMiddleware, asignarAEstudiantesSeleccionados);

// Preguntas y opciones
router.post('/evaluaciones/:id/preguntas', authMiddleware, addPreguntaConOpciones);
router.put('/evaluaciones/preguntas/:preguntaId', authMiddleware, updatePregunta);
router.delete('/preguntas/:preguntaId', authMiddleware, deletePregunta);
router.post('/evaluaciones/preguntas/:preguntaId/opciones', authMiddleware, addOpcion);
router.put('/evaluaciones/opciones/:opcionId', authMiddleware, updateOpcion);
router.delete('/evaluaciones/opciones/:opcionId', authMiddleware, deleteOpcion);

export default router;
