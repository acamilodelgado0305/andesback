// src/routes/studentAuthRoutes.js
import express from 'express';
import {
  studentLogin,
  studentSelectInstitution,
  studentSwitchInstitution,
  getStudentProfile,
} from '../controllers/studentauthController.js';
import { joinPrograma } from '../controllers/studentJoinController.js';
import {
  getMiPerfil,
  updateMiPerfil,
  uploadMiFoto,
  deleteMiFoto,
  listMisDocumentos,
  uploadMiDocumento,
  deleteMiDocumento,
} from '../controllers/studentSelfController.js';
import { studentAuthMiddleware } from '../middlewares/studentAuthMiddleware.js';
import uploadStudentDocument, {
  uploadStudentFoto,
} from '../middlewares/uploadStudentDocumentMiddleware.js';

// Multer corta la petición cuando el archivo no es del tipo permitido o pesa de
// más. Sin este envoltorio el error cae en el handler global de app.js, que
// responde 500 en texto plano y el portal no puede mostrarle al estudiante qué
// pasó. Aquí lo traducimos a un 400 con JSON.
const conArchivo = (middleware) => (req, res, next) =>
  middleware(req, res, (err) => {
    if (!err) return next();
    const esMuyGrande = err.code === 'LIMIT_FILE_SIZE';
    return res.status(400).json({
      ok: false,
      error: esMuyGrande
        ? 'El archivo es demasiado grande.'
        : err.message || 'No se pudo procesar el archivo.',
    });
  });

const router = express.Router();

// Login de estudiante (sin auth). Si el documento está en varias instituciones,
// devuelve la lista para que elija (sin token todavía).
router.post('/login', studentLogin);

// Elegir institución tras el login (sin auth; valida documento == registro elegido)
router.post('/select', studentSelectInstitution);

// Cambiar de institución ya dentro del campus (autenticado)
router.post('/switch', studentAuthMiddleware, studentSwitchInstitution);

// Unirse a un programa por enlace de inscripción (registro o inscripción, sin auth)
router.post('/join/:token', joinPrograma);

// Perfil del estudiante autenticado
router.get('/me', studentAuthMiddleware, getStudentProfile);

// =======================================================
// AUTOSERVICIO: el estudiante gestiona sus propios datos
// El id sale siempre del token, nunca de la URL.
// =======================================================

// Datos personales (ver / editar)
router.get('/me/perfil', studentAuthMiddleware, getMiPerfil);
router.put('/me/perfil', studentAuthMiddleware, updateMiPerfil);

// Foto de perfil (JPG/PNG/WebP, máx. 5 MB)
router.post(
  '/me/foto',
  studentAuthMiddleware,
  conArchivo(uploadStudentFoto.single('foto')),
  uploadMiFoto
);
router.delete('/me/foto', studentAuthMiddleware, deleteMiFoto);

// Mis documentos (PDF, máx. 10 MB)
router.get('/me/documentos', studentAuthMiddleware, listMisDocumentos);
router.post(
  '/me/documentos',
  studentAuthMiddleware,
  conArchivo(uploadStudentDocument.single('documento')),
  uploadMiDocumento
);
router.delete('/me/documentos/:documentoId', studentAuthMiddleware, deleteMiDocumento);

export default router;
