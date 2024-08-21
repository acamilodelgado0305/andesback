// routes/authRoutes.js
import express from 'express';
import { registerController, loginController } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerController); // Ruta para registrar un nuevo usuario
router.post('/login', loginController); // Ruta para iniciar sesión

export default router;
