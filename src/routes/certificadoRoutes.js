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
import {
    verificarPorCodigo,
    verificarPorNumeroDocumento,
} from '../controllers/verificacionController.js';

import {
    generarDiplomaController,
    generarConstanciaController,
    generarAcreditacionController,
    enviarAcreditacionController
} from '../controllers/diplomaController.js';

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

// --- Plantilla Diploma + Constancia (Alianza Capacitarte) ---
// Las dos piezas en un solo PDF (pág. 1 diploma, pág. 2 certificado) y con un
// folio compartido. Es la que usa el front.
router.post('/generar-acreditacion', generarAcreditacionController);
// Piezas sueltas, por si se necesita una sola. Cada una genera su propio folio.
router.post('/generar-diploma', generarDiplomaController);
router.post('/generar-constancia', generarConstanciaController);

// --- Envío por correo (genera el PDF y lo manda como adjunto) ---
router.post('/enviar-certificado', enviarCertificadoController);

router.post(
    '/enviar-carnet',
    upload.single('foto'),
    enviarCarnetController
);

// Envía la ACREDITACIÓN (diploma + certificado, un solo PDF de dos páginas).
// Es el envío por correo de la plantilla de Alianza Capacitarte: sirve para
// cualquier curso (Auxiliar de Bodega, Aseo Hospitalario…), por eso pide `curso`.
router.post('/enviar-acreditacion', enviarAcreditacionController);

// Envía CERTIFICADO + CARNET en un solo correo (un solo endpoint)
router.post(
    '/enviar-documentos',
    upload.single('foto'),
    enviarDocumentosController
);

// --- Verificación pública (página verificacion.html de Alianza Capacitarte) ---
// Por el código impreso debajo del QR, o todos los de un número de documento.
router.get('/verificar-documento', verificarPorNumeroDocumento);
router.get('/verificar-documento/:codigo', verificarPorCodigo);

export default router;