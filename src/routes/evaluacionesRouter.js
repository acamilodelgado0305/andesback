// src/routes/evaluacionesRouter.js
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
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
  getEvaluacionesDeEstudiante,
  getAsignacionDetalleParaResponder,
  responderEvaluacion,
} from '../controllers/evaluationController.js';

const router = express.Router();

// =================== RUTAS PARA ESTUDIANTES (sin auth requerida) ===================

router.get('/evaluaciones/estudiantes/:estudianteId/asignaciones', getEvaluacionesDeEstudiante);
router.get('/evaluaciones/asignaciones/:asignacionId', getAsignacionDetalleParaResponder);
router.post('/evaluaciones/asignaciones/:asignacionId/respuestas', responderEvaluacion);

// =================== RUTAS ADMIN (requieren authMiddleware) ===================

router.use(authMiddleware);

// CRUD Evaluaciones
router.get('/evaluaciones', getEvaluaciones);
router.get('/evaluaciones/evaluaciones/:id', getEvaluacionById);
router.post('/evaluaciones', createEvaluacion);
router.put('/evaluaciones/:id', updateEvaluacion);
router.delete('/evaluaciones/:id', deleteEvaluacion);

// Asignaciones
router.post('/evaluaciones/:id/asignar/programa-principal', asignarPorProgramaPrincipal);
router.post('/evaluaciones/:id/asignar/estudiante-programas', asignarPorEstudianteProgramas);

// Preguntas y opciones
router.post('/evaluaciones/:id/preguntas', addPreguntaConOpciones);
router.put('/evaluaciones/preguntas/:preguntaId', updatePregunta);
router.delete('/preguntas/:preguntaId', deletePregunta);
router.post('/evaluaciones/preguntas/:preguntaId/opciones', addOpcion);
router.put('/evaluaciones/opciones/:opcionId', updateOpcion);
router.delete('/evaluaciones/opciones/:opcionId', deleteOpcion);

export default router;
