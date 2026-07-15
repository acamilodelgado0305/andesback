// src/routes/studentAuthRoutes.js
import express from 'express';
import {
  studentLogin,
  studentSelectInstitution,
  studentSwitchInstitution,
  getStudentProfile,
} from '../controllers/studentauthController.js';
import { joinPrograma } from '../controllers/studentJoinController.js';
import { studentAuthMiddleware } from '../middlewares/studentAuthMiddleware.js';

const router = express.Router();

// Login de estudiante (sin auth). Si el documento está en varias instituciones,
// devuelve la lista para que elija (sin token todavía).
router.post('/login', studentLogin);

// Elegir institución tras el login (sin auth; valida documento == registro elegido)
router.post('/select', studentSelectInstitution);

// Cambiar de institución ya dentro del campus (autenticado)
router.post('/switch', studentAuthMiddleware, studentSwitchInstitution);

// Unirse a un programa por enlace de inscripción (registro o inscripción, sin auth)
router.post('/join/:token', joinPrograma);

// Perfil del estudiante autenticado
router.get('/me', studentAuthMiddleware, getStudentProfile);

export default router;
