// src/routes/demoRouter.js
//
// Endpoints internos del demo educativo. No los consume el navegador: los
// llama auth-service con el secreto compartido DEMO_SEED_SECRET. Por eso no
// pasan por authMiddleware (cuando corren, el visitante aún no tiene sesión).

import { Router } from 'express';
import { seedDemoBusiness, purgeDemoBusiness, requireInternalSecret } from '../controllers/demoController.js';

const router = Router();

router.post('/demo/seed', requireInternalSecret, seedDemoBusiness);
router.post('/demo/purge', requireInternalSecret, purgeDemoBusiness);

export default router;
