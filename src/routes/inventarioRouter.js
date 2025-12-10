// src/routes/inventarioRouter.js
import express from 'express';
import {
  createInventarioController,   // Renombrado
  getInventarioController,      // Renombrado
  getInventarioByIdController,  // Renombrado
  updateInventarioController,   // Renombrado
  deleteInventarioController,    // Renombrado
  getInventarioBySpecificUserController
} from '../controllers/inventarioController.js'; // Actualizada la ruta y los nombres importados

import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Aplica el middleware verifyToken a todas las rutas de inventario
// Esto asegura que solo usuarios autenticados puedan acceder a estas rutas.
//router.use(verifyToken);

// Rutas para manejar items de inventario
router.post('/inventario', createInventarioController);      // Crear un nuevo item de inventario
router.post('/inventario', createInventarioController);      // Crear un nuevo item de inventario
router.get('/inventario', authMiddleware,getInventarioController);         // Obtener todos los items de inventario del usuario
router.get('/inventario/:id', getInventarioByIdController); // Obtener un item de inventario por su ID
router.put('/inventario/:id', updateInventarioController);  // Actualizar un item de inventario por su ID
router.delete('/inventario', deleteInventarioController); // Eliminar un item de inventario por su ID
router.get('/inventario/user/:userId', getInventarioBySpecificUserController); // Nueva ruta

export default router;