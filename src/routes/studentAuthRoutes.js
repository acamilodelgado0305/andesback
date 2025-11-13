// src/routes/studentAuthRoutes.js
import express from 'express';
import {
  studentLogin,
  getStudentProfile,
} from '../controllers/studentauthController.js';
import { studentAuthMiddleware } from '../middlewares/studentAuthMiddleware.js';

const router = express.Router();

// Login de estudiante (sin auth)
router.post('/login', studentLogin);

// Perfil del estudiante autenticado
router.get('/me', studentAuthMiddleware, getStudentProfile);

export default router;
