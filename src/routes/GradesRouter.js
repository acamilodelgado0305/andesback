import express from 'express';
import {
  getGradesController,
  saveGradesController,
  getGradesByProgramaController,
} from '../controllers/GradesController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/grades', getGradesController);
router.post('/grades', saveGradesController);
router.get('/grades/programa/:programaId', getGradesByProgramaController);

export default router;
