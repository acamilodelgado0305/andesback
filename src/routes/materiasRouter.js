import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { flexAuthMiddleware } from '../middlewares/flexAuthMiddleware.js';
import {
  createMateria,
  getAllMaterias,
  getMateriaById,
  getMateriaDetalle,
  getMateriaProgresoEstudiante,
  updateMateria,
  deleteMateria,
  uploadMateriaBanner,
  duplicarMateria
} from '../controllers/materiasController.js';

// Multer en memoria — solo imágenes, máx 8 MB
const uploadBanner = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes.'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = Router();

// ─── Ruta estudiante (flexAuth) ──────────────────────────────────────────────
router.get('/materias/:id/estudiante/progreso', flexAuthMiddleware, getMateriaProgresoEstudiante);

router.get('/materias', authMiddleware, getAllMaterias);
// flexAuth: la usa tanto el admin (ProgramaDetalle) como el portal de
// estudiante (MateriaDetalle en modo solo-lectura).
router.get('/materias/:id/detalle', flexAuthMiddleware, getMateriaDetalle);
router.get('/materias/:id', authMiddleware, getMateriaById);
router.post('/materias', authMiddleware, createMateria);
router.post('/materias/:id/duplicar', authMiddleware, duplicarMateria);
router.put('/materias/:id', authMiddleware, updateMateria);
router.put('/materias/:id/banner', authMiddleware, uploadBanner.single('banner'), uploadMateriaBanner);
router.delete('/materias/:id', authMiddleware, deleteMateria);

export default router;
