// routes/programRoutes.js
import express from 'express';
import {
  createProgramController,
  getProgramsController,
  getProgramByIdController,
  updateProgramController,
  deleteProgramController
} from '../controllers/programController.js';

const router = express.Router();

// Rutas para manejar programas
router.post('/programs', createProgramController); // Crear un nuevo programa
router.get('/programs', getProgramsController); // Obtener todos los programas
router.get('/programs/:id', getProgramByIdController); // Obtener un programa por su ID
router.put('/programs/:id', updateProgramController); // Actualizar un programa por su ID
router.delete('/programs/:id', deleteProgramController); // Eliminar un programa por su ID

export default router;
