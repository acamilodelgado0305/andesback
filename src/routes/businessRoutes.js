// src/routes/businessRoutes.js

import express from 'express';
import multer from 'multer';
import { uploadBusinessProfilePicture } from '../controllers/businessController.js';

const router = express.Router();

// --- Configuración de Multer ---
// Usamos 'memoryStorage' para manejar el archivo en la RAM, es más rápido y eficiente.
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB por archivo
});

// --- Definición de la Ruta ---
// Esta ruta aceptará una petición PUT a, por ejemplo, /api/businesses/1/picture
// 'profilePicture' es el nombre del campo que el frontend debe usar para enviar el archivo.
router.put('/:businessId/picture', upload.single('profilePicture'), uploadBusinessProfilePicture);

export default router;