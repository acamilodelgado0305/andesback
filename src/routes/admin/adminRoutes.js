// src/routes/adminRoutes.js
import { Router } from 'express';
import {
    getSubscriptionsOverviewController,
    getClientDetailsController,
    createSubscriptionController,
    getSubscriptionExpirationController,
    renewSubscriptionController,
    getPlansController

} from '../../controllers/admin/adminController.js';

// ¡Importante! Aquí deberías añadir un middleware para proteger estas rutas
// y asegurarte de que solo un 'admin' o 'superadmin' pueda acceder.
// import { isAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

// router.use(isAdmin); // Descomenta cuando tengas tu middleware de autorización

// Rutas para la administración de clientes y suscripciones
router.get('/subscriptions', getSubscriptionsOverviewController);
router.get('/plans', getPlansController);
router.get('/subscriptions/expiration/:userId', getSubscriptionExpirationController);

router.get('/client-details/:userId', getClientDetailsController);
router.post('/subscriptions', createSubscriptionController);
router.post('/subscriptions/renew', renewSubscriptionController);


export default router;