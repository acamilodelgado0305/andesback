// routes/authRoutes.js
import express from 'express';
import { registerController, loginController, getUserByIdController, switchOrganizationController } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/registro/auth', registerController);
router.post('/login', loginController);
router.post('/organizations/switch', authMiddleware, switchOrganizationController);
router.get('/users/:id', getUserByIdController); // Obtener usuario por ID

export default router;
