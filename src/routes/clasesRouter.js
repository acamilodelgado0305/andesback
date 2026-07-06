// src/routes/clasesRouter.js
import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { flexAuthMiddleware } from '../middlewares/flexAuthMiddleware.js';
import {
  getClasesByModulo, getClaseById, createClase, updateClase, deleteClase,
  uploadClaseVideo, uploadPdfsClase, deletePdfDeClase,
  uploadPresentacionesClase, deletePresentacionDeClase, streamPresentacionFile,
  getClaseByIdEstudiante, completarClase, getClaseOutlineEstudiante,
} from '../controllers/clasesController.js';

// Video de la clase: solo archivos de video, hasta 500 MB
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Solo se permiten archivos de video.'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

// PDFs de la clase: mismo límite que los del tema
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

// Presentaciones de la clase: PDF, PPTX/PPT, SVG o HTML (hasta 50 MB). Se filtra
// por extensión porque el mimetype de PPTX/SVG/HTML varía según el navegador/SO.
const PRESENTACION_EXT = /\.(pdf|pptx|ppt|svg|html?)$/i;
const uploadPresentacion = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!PRESENTACION_EXT.test(file.originalname || '')) {
      return cb(new Error('Solo se permiten archivos PDF, PPTX, SVG o HTML.'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = express.Router();

router.get('/modulos/:moduloId/clases', authMiddleware, getClasesByModulo);
router.post('/modulos/:moduloId/clases', authMiddleware, createClase);

// Proxy same-origin del archivo de una presentación (para pdf.js sin CORS).
// Va antes de '/clases/:id' — el path es distinto, pero lo dejamos explícito.
router.get('/clases/presentaciones/:presId/file', flexAuthMiddleware, streamPresentacionFile);

router.get('/clases/:id/estudiante', flexAuthMiddleware, getClaseByIdEstudiante);
router.get('/clases/:id/outline/estudiante', flexAuthMiddleware, getClaseOutlineEstudiante);
router.patch('/clases/:id/completar', flexAuthMiddleware, completarClase);

router.get('/clases/:id', authMiddleware, getClaseById);
router.put('/clases/:id', authMiddleware, updateClase);
router.delete('/clases/:id', authMiddleware, deleteClase);
router.post('/clases/:id/video', authMiddleware, uploadVideo.single('video'), uploadClaseVideo);
router.post('/clases/:id/pdfs', authMiddleware, uploadPdf.array('pdfs', 10), uploadPdfsClase);
router.delete('/clases/:id/pdfs/:pdfId', authMiddleware, deletePdfDeClase);
router.post('/clases/:id/presentaciones', authMiddleware, uploadPresentacion.array('presentaciones', 10), uploadPresentacionesClase);
router.delete('/clases/:id/presentaciones/:presId', authMiddleware, deletePresentacionDeClase);

export default router;
