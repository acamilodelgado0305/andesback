import { Router } from 'express';
import {
  createDocente,
  getAllDocentes,
  getDocenteById,
  updateDocente,
  deleteDocente,
} from '../controllers/docenteController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/docentes',        authMiddleware, getAllDocentes);
router.get('/docentes/:id',    authMiddleware, getDocenteById);
router.post('/docentes',       authMiddleware, createDocente);
router.put('/docentes/:id',    authMiddleware, updateDocente);
router.delete('/docentes/:id', authMiddleware, deleteDocente);

export default router;
