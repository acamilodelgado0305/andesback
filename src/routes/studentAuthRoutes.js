// src/routes/studentAuthRoutes.js
import express from 'express';
import {
  studentLogin,
  getStudentProfile,
} from '../controllers/studentauthController.js';
import { joinPrograma } from '../controllers/studentJoinController.js';
import { studentAuthMiddleware } from '../middlewares/studentAuthMiddleware.js';

const router = express.Router();

// Login de estudiante (sin auth)
router.post('/login', studentLogin);

// Unirse a un programa por enlace de inscripción (registro o inscripción, sin auth)
router.post('/join/:token', joinPrograma);

// Perfil del estudiante autenticado
router.get('/me', studentAuthMiddleware, getStudentProfile);

export default router;
