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

router.use(authMiddleware);

router.get('/materias', getAllMaterias);
router.get('/materias/:id', getMateriaById);
router.post('/materias', createMateria);
router.put('/materias/:id', updateMateria);
router.delete('/materias/:id', deleteMateria);

export default router;
