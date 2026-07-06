// src/routes/foroRouter.js
import express from 'express';
import multer from 'multer';
import { flexAuthMiddleware } from '../middlewares/flexAuthMiddleware.js';
import {
  getPostsByMateria,
  createPost,
  deletePost,
} from '../controllers/foroController.js';
import { getMateriasDeEstudiante } from '../controllers/materiasController.js';

// Multer en memoria — cualquier tipo de archivo, hasta 5 por publicación, máx 25 MB c/u
const uploadAdjuntos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = express.Router();

// Materias del estudiante (para el foro del portal) — admin o el propio estudiante
router.get('/estudiantes/:estudianteId/materias', flexAuthMiddleware, getMateriasDeEstudiante);

// Foro de la materia — accesible por admin/docente (token admin) y estudiante (token portal)
router.get('/materias/:materiaId/foro', flexAuthMiddleware, getPostsByMateria);
router.post('/materias/:materiaId/foro', flexAuthMiddleware, uploadAdjuntos.array('archivos', 5), createPost);
router.delete('/foro/:postId', flexAuthMiddleware, deletePost);

export default router;
