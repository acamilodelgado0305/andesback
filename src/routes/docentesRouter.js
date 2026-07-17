import { Router } from 'express';
import {
  createDocente,
  getAllDocentes,
  getDocenteById,
  updateDocente,
  deleteDocente,
  getMyDocenteProfile,
  updateMyDocenteProfile,
  getMyProgramas,
  setDocenteAcceso,
  removeDocenteAcceso,
} from '../controllers/docenteController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// --- Perfil propio del docente autenticado (rol 'docente') ---
// Van ANTES de '/docentes/:id' para que 'me' no sea capturado como un id.
router.get('/docentes/me',           authMiddleware, getMyDocenteProfile);
router.put('/docentes/me',           authMiddleware, updateMyDocenteProfile);
router.get('/docentes/me/programas', authMiddleware, getMyProgramas);

// --- Enlace de acceso (lo gestiona el admin) ---
router.put('/docentes/:id/acceso',    authMiddleware, setDocenteAcceso);
router.delete('/docentes/:id/acceso', authMiddleware, removeDocenteAcceso);

// --- CRUD de docentes (admin) ---
router.get('/docentes',        authMiddleware, getAllDocentes);
router.get('/docentes/:id',    authMiddleware, getDocenteById);
router.post('/docentes',       authMiddleware, createDocente);
router.put('/docentes/:id',    authMiddleware, updateDocente);
router.delete('/docentes/:id', authMiddleware, deleteDocente);

export default router;
