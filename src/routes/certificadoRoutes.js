// src/routes/certificadoRoutes.js
import { Router } from 'express';
import { 
    generarCertificadoController, // Para certificados
    generarCarnetController       // Para carnets
} from '../controllers/certificadoController.js'; 


import { 
      generarDocumentosController
} from '../controllers/CertificadosController.js'; 

// Si necesitas autenticación para estas rutas, importa tu middleware
// import { verifyToken } from '../middleware/authMiddleware.js'; 

const router = Router();

// Ruta para generar un certificado (Docs o Slides, según tu configuración de APPS_SCRIPT_WEB_APP_URL_CERTIFICADO)
router.post('/generar-certificado', 
    // verifyToken, // Descomenta si requieres autenticación
    generarCertificadoController
);

// NUEVA RUTA para generar un carnet
router.post('/generar-carnet', 
    // verifyToken, // Descomenta si requieres autenticación
    generarCarnetController
);


router.post('/generar-documentos', 
    // verifyToken, // Descomenta si requieres autenticación
    generarDocumentosController
);

export default router;