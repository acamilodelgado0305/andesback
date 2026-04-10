import express from 'express';
import {
  createStudentAuthenticated,
  createStudentPublic,
  getStudentsController,
  getStudentByIdController,
  updateStudentController,
  deleteStudentController,
  updateEstadoStudentController,
  getStudentsByProgramTypeController,
  getStudentsByProgramaIdController,
  getStudentsByCoordinatorIdController,
  getStudentByDocumentController,
  updatePosibleGraduacionStudentController,
  graduateStudentController,
  uploadStudentDocumentController,
  getStudentDocumentsController,
  deleteStudentDocumentController
} from '../controllers/studentController.js';

import { authMiddleware } from '../middlewares/authMiddleware.js';

import { getGradesByStudentIdController, getGradesByStudentDocumentController } from '../controllers/GradesController.js';

import { uploadStudentsController } from "../controllers/uploadStudentsController.js";
import upload from "../uploadMiddleware.js";

import uploadStudentDocument from '../middlewares/uploadStudentDocumentMiddleware.js';

const router = express.Router();

// =======================================================
// RUTAS DE ESTUDIANTES
// =======================================================
router.post('/public/students', createStudentPublic);
// POST: Crear un nuevo estudiante
router.post('/students', authMiddleware, createStudentAuthenticated);


// 2. Ruta PÚBLICA (Para usar desde landing pages o formularios externos)
// No requiere token. Requiere enviar 'coordinador_id' en el body.


// GET: Obtener estudiantes filtrados por TIPO de programa (bachillerato o tecnicos)
// NOTA: Esta ruta debe ir ANTES de '/students/:id' para evitar conflictos.
router.get('/students/type/:tipo', authMiddleware, getStudentsByProgramTypeController);
// Ejemplo de uso:
// GET /api/students/type/bachillerato
// GET /api/students/type/tecnicos

router.get('/students', authMiddleware, getStudentsController);

// GET: Obtener estudiantes filtrados por ID de programa específico
// NOTA: Esta ruta también debe ir ANTES de '/students/:id'.
router.get('/students/program/:programaId', getStudentsByProgramaIdController);
// Ejemplo de uso:
// GET /api/students/program/1 (asumiendo que 1 es el ID de un programa)

router.get('/students/document/:numero_documento', getStudentByDocumentController);

// GET: Obtener estudiantes por coordinador (DEBE ir antes de /students/:id)
router.get('/students/coordinator/:coordinatorId', getStudentsByCoordinatorIdController);

// GET: Obtener un estudiante por su ID (rutas estáticas deben ir antes que esta)
router.get('/students/:id', getStudentByIdController);


// PUT: Actualizar el estado de matrícula de un estudiante por su ID
// NOTA: Ruta específica, idealmente antes de la ruta PUT genérica si el orden importa
router.put('/students/status_matricula/:id', updateEstadoStudentController);

// PUT: Marcar estudiante como graduado
router.put('/students/:id/graduate', authMiddleware, graduateStudentController);

// PUT: Actualizar un estudiante por su ID (todos los campos)
router.put('/students/:id', updateStudentController);

// DELETE: Eliminar un estudiante por su ID
router.delete('/students/:id', deleteStudentController);

// POST: Subir archivo de estudiantes
router.post('/upload-students', upload.single('file'), uploadStudentsController);



// =======================================================
// RUTAS DE CALIFICACIONES (GRADES) - (ya las tenías bien)
// =======================================================

// GET: Obtener calificaciones de un estudiante por su ID
router.get('/grades/students/:id', getGradesByStudentIdController);

// GET: Obtener calificaciones de un estudiante por su número de documento
router.get('/grades/student/:numero_documento', getGradesByStudentDocumentController);

// PATCH /students/:id/posible-graduacion
router.patch('/students/:id/posible-graduacion', updatePosibleGraduacionStudentController);

router.post(
  "/students/:id/document",
  uploadStudentDocument.single("document"),
  uploadStudentDocumentController
);

// routes/studentRoutes.js
router.get("/students/:id/documents", getStudentDocumentsController);
// routes/studentRoutes.js
router.delete("/students/:studentId/documents/:documentId", deleteStudentDocumentController);





export default router;