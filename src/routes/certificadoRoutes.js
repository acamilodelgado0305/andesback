// src/routes/certificadoRoutes.js

import { Router } from 'express';
import multer from 'multer'; // <-- 1. IMPORTANTE: Importar multer

import {
    generarCertificadoController,
    generarCarnetController
} from '../controllers/certificadoController.js';

import { generarCertificadoPDF } from '../controllers/certificadosPdfController.js';

const router = Router();

// Configuración de multer para que guarde los archivos en la carpeta 'uploads/'
const upload = multer({ dest: 'uploads/' });

// Ruta para generar un certificado (no necesita multer)
router.post('/generar-certificado',
    generarCertificadoController
);


router.post(
    '/generar-carnet',
    upload.single('foto'), // <-- 2. IMPORTANTE: Aplicar el middleware aquí
    generarCarnetController
);

router.post('/generar-certificado-pdf', generarCertificadoPDF);

export default router;