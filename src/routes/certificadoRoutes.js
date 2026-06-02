// src/routes/certificadoRoutes.js

import { Router } from 'express';
import multer from 'multer'; // <-- 1. IMPORTANTE: Importar multer

import {
    generarCertificadoController,
    generarCarnetController,
    enviarCertificadoController,
    enviarCarnetController,
    enviarDocumentosController
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

// --- Envío por correo (genera el PDF y lo manda como adjunto) ---
router.post('/enviar-certificado', enviarCertificadoController);

router.post(
    '/enviar-carnet',
    upload.single('foto'),
    enviarCarnetController
);

// Envía CERTIFICADO + CARNET en un solo correo (un solo endpoint)
router.post(
    '/enviar-documentos',
    upload.single('foto'),
    enviarDocumentosController
);

export default router;