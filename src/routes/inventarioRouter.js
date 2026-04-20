import express from 'express';
import multer from 'multer'; // 1. Importamos Multer
import {
    createInventarioItem,
    getInventario,
    updateInventarioItem,
    deleteInventarioItem,
    getInventarioByUserId
} from '../controllers/inventarioController.js';

import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// --- CONFIGURACIÓN DE MULTER ---
// Usamos memoryStorage para tener el Buffer disponible para Google Cloud
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Opcional: Límite de 5MB por foto
});

// --- RUTAS DE INVENTARIO ---
router.get('/inventario', authMiddleware, getInventario);
router.post('/inventario', authMiddleware, upload.single('imagen'), createInventarioItem);
router.put('/inventario/:id', authMiddleware, upload.single('imagen'), updateInventarioItem);
router.delete('/inventario/:id', authMiddleware, deleteInventarioItem);
router.delete('/inventario/', authMiddleware, deleteInventarioItem);
router.get('/user/:userId', authMiddleware, getInventarioByUserId);

export default router;