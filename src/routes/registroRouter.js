import express from 'express';
import {
    createUserRegController,
    getUsersRegController,
    getUserRegByIdController,
    updateUserRegController,
    deleteUserRegController,
} from '../controllers/registroController.js';

const router = express.Router();

// Rutas para manejar estudiantes
router.post('/regs', createUserRegController); // Crear un nuevo estudiante
router.get('/regs', getUsersRegController); // Obtener todos los estudiantes
router.get('/regs/:id', getUserRegByIdController); // Obtener un estudiante por su ID
router.put('/regs/:id', updateUserRegController); // Actualizar un estudiante por su ID
router.delete('/regs/:id', deleteUserRegController); // Eliminar un estudiante por su ID

export default router;
