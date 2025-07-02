import express from 'express';
import {
  createStudentController,
  getStudentsController,
  getStudentByIdController,
  updateStudentController,
  deleteStudentController,
  updateEstadoStudentController,
  // === Controladores de filtrado actualizados ===
  getStudentsByProgramTypeController, // Reemplaza getStudentsByBachilleratoController y getStudentsByTecnicosController
  getStudentsByProgramaIdController   // Nuevo para filtrar por ID de programa
} from '../controllers/studentController.js';

import { getGradesByStudentIdController, getGradesByStudentDocumentController } from '../controllers/GradesController.js';

import { uploadStudentsController } from "../controllers/uploadStudentsController.js";
import upload from "../uploadMiddleware.js";

const router = express.Router();

// =======================================================
// RUTAS DE ESTUDIANTES
// =======================================================

// POST: Crear un nuevo estudiante
router.post('/students', createStudentController);

// GET: Obtener estudiantes filtrados por TIPO de programa (bachillerato o tecnicos)
// NOTA: Esta ruta debe ir ANTES de '/students/:id' para evitar conflictos.
router.get('/students/type/:tipo', getStudentsByProgramTypeController);
// Ejemplo de uso:
// GET /api/students/type/bachillerato
// GET /api/students/type/tecnicos

// GET: Obtener estudiantes filtrados por ID de programa específico
// NOTA: Esta ruta también debe ir ANTES de '/students/:id'.
router.get('/students/program/:programaId', getStudentsByProgramaIdController);
// Ejemplo de uso:
// GET /api/students/program/1 (asumiendo que 1 es el ID de un programa)


// GET: Obtener todos los estudiantes (esta debe ir después de las rutas estáticas)
router.get('/students', getStudentsController);

// GET: Obtener un estudiante por su ID
// Esta ruta debe ir DESPUÉS de las rutas estáticas como /students/type/:tipo
// para que 'type' o 'program' no sean interpretados como un ID.
router.get('/students/:id', getStudentByIdController);


// PUT: Actualizar el estado de matrícula de un estudiante por su ID
// NOTA: Ruta específica, idealmente antes de la ruta PUT genérica si el orden importa
router.put('/students/status_matricula/:id', updateEstadoStudentController);

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


export default router;