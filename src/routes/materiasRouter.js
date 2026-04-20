import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
  createMateria,
  getAllMaterias,
  getMateriaById,
  updateMateria,
  deleteMateria
} from '../controllers/materiasController.js';

const router = Router();

router.get('/materias', authMiddleware, getAllMaterias);
router.get('/materias/:id', authMiddleware, getMateriaById);
router.post('/materias', authMiddleware, createMateria);
router.put('/materias/:id', authMiddleware, updateMateria);
router.delete('/materias/:id', authMiddleware, deleteMateria);

export default router;
