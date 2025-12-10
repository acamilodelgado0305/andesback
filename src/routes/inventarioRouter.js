import express from 'express';
import {
    createInventarioItem,
    getInventario,
    updateInventarioItem,
    deleteInventarioItem,
    getInventarioByUserId
} from '../controllers/inventarioController.js';

// Importa tu middleware de verificación de token
// Asegúrate de que la ruta sea correcta (authMiddleware o verifyToken según tu proyecto)
import { authMiddleware } from '../middlewares/authMiddleware.js'; 

const router = express.Router();

// --- MIDDLEWARE DE PROTECCIÓN GLOBAL ---
// Todas las rutas debajo de esta línea requieren Token válido
router.use(authMiddleware);

// --- RUTAS DE INVENTARIO ---

// Obtener todos los productos del usuario logueado
router.get('/inventario', getInventario);

// Crear nuevo producto
router.post('/inventario', createInventarioItem);

// Actualizar producto por ID
router.put('/inventario/:id', updateInventarioItem);

// Eliminar producto por ID (Individual)
router.delete('/inventario/:id', deleteInventarioItem);

// Eliminar múltiples productos (Opcional, enviando array de IDs en body)
router.delete('/inventario/', deleteInventarioItem);

// Ruta para admin o casos especiales (ver inventario de otro usuario)
router.get('/user/:userId', getInventarioByUserId);

export default router;