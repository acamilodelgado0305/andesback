// src/routes/certificadoRoutes.js

import { Router } from 'express';
import multer from 'multer'; // <-- 1. IMPORTANTE: Importar multer

import { 
    generarCertificadoController,
    generarCarnetController 
} from '../controllers/certificadoController.js';

// Si necesitas autenticación para estas rutas, importa tu middleware
// import { verifyToken } from '../middleware/authMiddleware.js'; 

const router = Router();

// Configuración de multer para que guarde los archivos en la carpeta 'uploads/'
const upload = multer({ dest: 'uploads/' });

// Ruta para generar un certificado (no necesita multer)
router.post('/generar-certificado', 
    // verifyToken,
    generarCertificadoController
);

// RUTA PARA GENERAR CARNET (ACTUALIZADA)
// Le decimos a Express que ANTES de ejecutar 'generarCarnetController',
// debe pasar por el middleware de multer para procesar un único archivo
// que vendrá en el campo llamado 'foto'.
router.post(
    '/generar-carnet', 
    // verifyToken, 
    upload.single('foto'), // <-- 2. IMPORTANTE: Aplicar el middleware aquí
    generarCarnetController
);

export default router;