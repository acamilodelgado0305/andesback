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

router.use(authMiddleware); // Protege todas las rutas de docentes

router.get('/docentes',      getAllDocentes);
router.get('/docentes/:id',  getDocenteById);
router.post('/docentes',     createDocente);
router.put('/docentes/:id',  updateDocente);
router.delete('/docentes/:id', deleteDocente);

export default router;
