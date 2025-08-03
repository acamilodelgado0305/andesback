// src/routes/adminRoutes.js
import { Router } from 'express';
import {
    getAllClientsController,
    getClientDetailsController,
    createSubscriptionController,
    getSubscriptionExpirationController

} from '../../controllers/admin/adminController.js';

// ¡Importante! Aquí deberías añadir un middleware para proteger estas rutas
// y asegurarte de que solo un 'admin' o 'superadmin' pueda acceder.
// import { isAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

// router.use(isAdmin); // Descomenta cuando tengas tu middleware de autorización

// Rutas para la administración de clientes y suscripciones
router.get('/clients', getAllClientsController);
router.get('/subscriptions/expiration/:userId', getSubscriptionExpirationController);

router.get('/clients/:userId', getClientDetailsController);
router.post('/subscriptions', createSubscriptionController);


export default router;