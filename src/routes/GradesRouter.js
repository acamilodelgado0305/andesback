import express from 'express';
import {
  getGradesController,
  saveGradesController,
  getGradesByProgramaController,
  getGradesByStudentIdController,
  getGradesByStudentDocumentController,
} from '../controllers/GradesController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { flexAuthMiddleware } from '../middlewares/flexAuthMiddleware.js';

const router = express.Router();

// =================== RUTAS ESTUDIANTE (acepta token admin O token estudiante) ===================
router.get('/grades/students/:id', flexAuthMiddleware, getGradesByStudentIdController);
router.get('/grades/student/:numero_documento', flexAuthMiddleware, getGradesByStudentDocumentController);

// =================== RUTAS ADMIN (requieren authMiddleware) ===================
router.use(authMiddleware);

router.get('/grades', getGradesController);
router.post('/grades', saveGradesController);
router.get('/grades/programa/:programaId', getGradesByProgramaController);

export default router;

