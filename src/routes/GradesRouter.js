import express from 'express';
import {
  getGradesController,
  saveGradesController, // Nuevo controlador
} from '../controllers/GradesController.js';
const router = express.Router();

router.get('/grades', getGradesController); // Nueva ruta
router.post('/grades', saveGradesController); // Nueva ruta

export default router;