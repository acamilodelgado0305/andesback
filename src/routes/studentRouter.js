import express from 'express';
import {

  createStudentAuthenticated, // Nuevo controlador seguro
  createStudentPublic,
  getStudentsController,
  getStudentByIdController,
  updateStudentController,
  deleteStudentController,
  updateEstadoStudentController,
  // === Controladores de filtrado actualizados ===
  getStudentsByProgramTypeController, // Reemplaza getStudentsByBachilleratoController y getStudentsByTecnicosController
  getStudentsByProgramaIdController,  // Nuevo para filtrar por ID de programa
  getStudentsByCoordinatorIdController,
  getStudentByDocumentController,
  updatePosibleGraduacionStudentController,
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

router.get('/students', authMiddleware, getStudentsController);

// GET: Obtener estudiantes filtrados por ID de programa específico
// NOTA: Esta ruta también debe ir ANTES de '/students/:id'.
router.get('/students/program/:programaId', authMiddleware, getStudentsByProgramaIdController);

router.get('/students/document/:numero_documento', authMiddleware, getStudentByDocumentController);

// GET: Obtener un estudiante por su ID
// Esta ruta debe ir DESPUÉS de las rutas estáticas como /students/type/:tipo
// para que 'type' o 'program' no sean interpretados como un ID.
router.get('/students/:id', authMiddleware, getStudentByIdController);

// PUT: Actualizar el estado de matrícula de un estudiante por su ID
router.put('/students/status_matricula/:id', authMiddleware, updateEstadoStudentController);

// PUT: Actualizar un estudiante por su ID (todos los campos)
router.put('/students/:id', authMiddleware, updateStudentController);

// DELETE: Eliminar un estudiante por su ID
router.delete('/students/:id', authMiddleware, deleteStudentController);

// POST: Subir archivo de estudiantes
router.post('/upload-students', authMiddleware, upload.single('file'), uploadStudentsController);

router.get('/students/coordinator/:coordinatorId', authMiddleware, getStudentsByCoordinatorIdController);


// =======================================================
// RUTAS DE CALIFICACIONES (GRADES)
// =======================================================

// GET: Obtener calificaciones de un estudiante por su ID
router.get('/grades/students/:id', authMiddleware, getGradesByStudentIdController);

// GET: Obtener calificaciones de un estudiante por su número de documento
router.get('/grades/student/:numero_documento', authMiddleware, getGradesByStudentDocumentController);

// PATCH /students/:id/posible-graduacion
router.patch('/students/:id/posible-graduacion', authMiddleware, updatePosibleGraduacionStudentController);

router.post(
  "/students/:id/document",
  authMiddleware,
  uploadStudentDocument.single("document"),
  uploadStudentDocumentController
);

// GET: Obtener documentos de un estudiante
router.get("/students/:id/documents", authMiddleware, getStudentDocumentsController);

// DELETE: Eliminar documento de un estudiante
router.delete("/students/:studentId/documents/:documentId", authMiddleware, deleteStudentDocumentController);





export default router;