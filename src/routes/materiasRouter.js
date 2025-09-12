import { Router } from 'express';
import {
  createMateria,
  getAllMaterias,
  getMateriaById,
  updateMateria,
  deleteMateria
} from '../controllers/materiasController.js';

const router = Router();

// --- RUTAS PARA MATERIAS ---

// [GET] Obtener todas las materias (con información del docente)
// http://localhost:3000/api/materias
router.get('/materias', getAllMaterias);

// [GET] Obtener una sola materia por su ID (con información del docente)
// http://localhost:3000/api/materias/2
router.get('/materias/:id', getMateriaById);

// [POST] Crear una nueva materia
// http://localhost:3000/api/materias
router.post('/materias', createMateria);

// [PUT] Actualizar una materia existente por su ID
// http://localhost:3000/api/materias/2
router.put('/materias/:id', updateMateria);

// [DELETE] Eliminar una materia por su ID
// http://localhost:3000/api/materias/2
router.delete('/materias/:id', deleteMateria);

export default router;