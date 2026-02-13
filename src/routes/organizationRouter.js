// routes/organizationRouter.js
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
    createUserInOrganization,
    getUsersByOrganization,
    removeUserFromOrganization,
} from '../controllers/organizationController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// POST   /api/organizations/:organizationId/users  → Crear usuario en una organización
router.post('/organizations/:organizationId/users', createUserInOrganization);

// GET    /api/organizations/:organizationId/users  → Obtener usuarios de una organización
router.get('/organizations/:organizationId/users', getUsersByOrganization);

// DELETE /api/organizations/:organizationId/users/:userId → Remover usuario de una organización
router.delete('/organizations/:organizationId/users/:userId', removeUserFromOrganization);

export default router;
