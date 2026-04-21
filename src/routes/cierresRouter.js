import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
    getCierresByProgramaController,
    createCierreController,
    cerrarCierreController,
    deleteCierreController,
} from '../controllers/cierresController.js';

const router = express.Router();

router.get('/cierres/programa/:programaId', authMiddleware, getCierresByProgramaController);
router.post('/cierres', authMiddleware, createCierreController);
router.put('/cierres/:id/cerrar', authMiddleware, cerrarCierreController);
router.delete('/cierres/:id', authMiddleware, deleteCierreController);

export default router;
