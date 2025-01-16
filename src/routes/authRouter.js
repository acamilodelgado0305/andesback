// routes/authRoutes.js
import express from 'express';
import { registerController, loginController, getUserByIdController } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerController);
router.post('/login', loginController);
router.get('/users/:id', getUserByIdController); // Obtener usuario por ID

export default router;
