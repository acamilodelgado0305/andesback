// src/routes/modulosRouter.js
import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { flexAuthMiddleware } from '../middlewares/flexAuthMiddleware.js';
import {
  getModulos,
  getModuloById,
  createModulo,
  updateModulo,
  deleteModulo,
  uploadPdfsModulo,
  deletePdfDeModulo,
  addEvaluacionToModulo,
  removeEvaluacionFromModulo,
  asignarEstudiantes,
  quitarEstudiante,
  marcarWhatsappEnviado,
  getModulosDeEstudiante,
  getModuloDetalleEstudiante,
} from '../controllers/modulosController.js';

// Multer en memoria — solo PDFs, hasta 10 archivos, máx 20 MB c/u
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Solo se permiten archivos PDF.'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router = express.Router();

// ─── Rutas estudiante (flexAuth) ─────────────────────────────────────────────
router.get('/modulos/estudiante/:estudianteId', flexAuthMiddleware, getModulosDeEstudiante);
router.get('/modulos/:id/estudiante', flexAuthMiddleware, getModuloDetalleEstudiante);

// ─── Rutas admin ─────────────────────────────────────────────────────────────
router.get('/modulos',     authMiddleware, getModulos);
router.get('/modulos/:id', authMiddleware, getModuloById);
router.post('/modulos',    authMiddleware, createModulo);
router.put('/modulos/:id', authMiddleware, updateModulo);
router.delete('/modulos/:id', authMiddleware, deleteModulo);

// PDFs del módulo (múltiples)
router.post('/modulos/:id/pdfs', authMiddleware, uploadPdf.array('pdfs', 10), uploadPdfsModulo);
router.delete('/modulos/:id/pdfs/:pdfId', authMiddleware, deletePdfDeModulo);

// Evaluaciones vinculadas
router.post('/modulos/:id/evaluaciones', authMiddleware, addEvaluacionToModulo);
router.delete('/modulos/:id/evaluaciones/:evalId', authMiddleware, removeEvaluacionFromModulo);

// Estudiantes asignados
router.post('/modulos/:id/estudiantes', authMiddleware, asignarEstudiantes);
router.delete('/modulos/:id/estudiantes/:estId', authMiddleware, quitarEstudiante);
router.patch('/modulos/:id/estudiantes/:estId/whatsapp', authMiddleware, marcarWhatsappEnviado);

export default router;
