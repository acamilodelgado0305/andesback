import { Router } from 'express';
import {
  createDocente,
  getAllDocentes,
  getDocenteById,
  updateDocente,
  deleteDocente
} from '../controllers/docenteController.js';

const router = Router();

// --- RUTAS PARA DOCENTES ---

// [GET] Obtener todos los docentes
// http://localhost:3000/api/docentes
router.get('/docentes', getAllDocentes);

// [GET] Obtener un solo docente por su ID
// http://localhost:3000/api/docentes/1
router.get('/docentes/:id', getDocenteById);

// [POST] Crear un nuevo docente
// http://localhost:3000/api/docentes
router.post('/docentes', createDocente);

// [PUT] Actualizar un docente existente por su ID
// http://localhost:3000/api/docentes/1
router.put('/docentes/:id', updateDocente);

// [DELETE] Eliminar un docente por su ID
// http://localhost:3000/api/docentes/1
router.delete('/docentes/:id', deleteDocente);


export default router;