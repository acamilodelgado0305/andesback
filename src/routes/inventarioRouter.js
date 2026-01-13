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

// --- MIDDLEWARE DE PROTECCIÓN GLOBAL ---
router.use(authMiddleware);

// --- RUTAS DE INVENTARIO ---

// Obtener todos los productos (Sin cambios)
router.get('/inventario', getInventario);

// Crear nuevo producto (Agregamos upload.single('imagen'))
// 'imagen' es el nombre del campo (key) que debes usar en Postman/React
router.post('/inventario', upload.single('imagen'), createInventarioItem);

// Actualizar producto por ID (Agregamos upload.single('imagen'))
router.put('/inventario/:id', upload.single('imagen'), updateInventarioItem);

// Eliminar producto por ID (Sin cambios)
router.delete('/inventario/:id', deleteInventarioItem);

// Eliminar múltiples productos (Sin cambios)
router.delete('/inventario/', deleteInventarioItem);

// Ruta para admin (Sin cambios)
router.get('/user/:userId', getInventarioByUserId);

export default router;