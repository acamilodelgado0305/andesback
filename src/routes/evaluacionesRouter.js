// src/routes/evaluacionesRouter.js
import express from 'express';
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

// =================== RUTAS PARA ESTUDIANTES ===================

// Listar evaluaciones de un estudiante
router.get(
  '/evaluaciones/estudiantes/:estudianteId/asignaciones',
  getEvaluacionesDeEstudiante
);

// Obtener detalle de una asignación (para responder)
router.get(
  '/evaluaciones/asignaciones/:asignacionId',
  getAsignacionDetalleParaResponder
);

// Enviar respuestas de una asignación
router.post('/evaluaciones/asignaciones/:asignacionId/respuestas', responderEvaluacion);

// =================== ASIGNACIONES (ADMIN) ===================

// Asignar evaluación por programa principal (students.programa_id)
router.post('/evaluaciones/:id/asignar/programa-principal', asignarPorProgramaPrincipal);

// Asignar evaluación usando estudiante_programas
router.post(
  '/evaluaciones/:id/asignar/estudiante-programas',
  asignarPorEstudianteProgramas
);

// =================== PREGUNTAS Y OPCIONES (ADMIN) ===================

// Crear pregunta (con opciones) para una evaluación
router.post('/evaluaciones/:id/preguntas', addPreguntaConOpciones);

// Actualizar / eliminar pregunta
router.put('/evaluaciones/preguntas/:preguntaId', updatePregunta);
router.delete('/preguntas/:preguntaId', deletePregunta);

// Crear / actualizar / eliminar opción
router.post('/evaluaciones/preguntas/:preguntaId/opciones', addOpcion);
router.put('/evaluaciones/opciones/:opcionId', updateOpcion);
router.delete('/evaluaciones/opciones/:opcionId', deleteOpcion);

// =================== CRUD EVALUACIONES (ADMIN) ===================

// Crear evaluación
router.post('/evaluaciones', createEvaluacion);

// Listar evaluaciones
router.get('/evaluaciones', getEvaluaciones);

// Obtener evaluación + preguntas (modo admin)
router.get('/evaluaciones/evaluaciones/:id', getEvaluacionById);

// Actualizar evaluación
router.put('/evaluaciones/:id', updateEvaluacion);

// Eliminar evaluación
router.delete('/evaluaciones/:id', deleteEvaluacion);

export default router;
