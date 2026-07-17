// src/routes/programasRouter.js
import express from "express";
import {
  createPrograma,
  getProgramas,
  getProgramaById,
  getProgramaDetalle,
  updatePrograma,
  deletePrograma,
  getProgramaDocentes,
  addProgramaDocente,
  removeProgramaDocente,
  generateJoinLink,
  toggleJoinLink,
  getJoinInfo,
  listJoinLinks,
  createJoinLink,
  setJoinLinkEnabled,
  regenerateJoinLink,
  deleteJoinLink,
  getProgramaProgreso,
  getEstudianteProgresoPrograma,
  removeEstudianteFromPrograma,
} from "../controllers/programasController.js";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/authMiddleware.js";
import { docenteProgramaGuard } from "../middlewares/docenteAccess.js";

const router = express.Router();

// GET: optionalAuth — si hay token filtra por business, si no devuelve todos (formularios públicos).
// getProgramas también restringe a sus programas cuando el rol es 'docente'.
router.get("/programas",              optionalAuthMiddleware, getProgramas);
router.get("/programas/:id/detalle",  authMiddleware, docenteProgramaGuard, getProgramaDetalle);   // detalle completo admin

// Avance por estudiante (clases vistas / pendientes)
router.get("/programas/:id/progreso",                          authMiddleware, docenteProgramaGuard, getProgramaProgreso);
router.get("/programas/:id/estudiantes/:estudianteId/progreso", authMiddleware, docenteProgramaGuard, getEstudianteProgresoPrograma);

// Sacar un estudiante del programa (lo desvincula; no lo archiva ni lo borra)
router.delete("/programas/:id/estudiantes/:estudianteId", authMiddleware, docenteProgramaGuard, removeEstudianteFromPrograma);

// Docentes asociados a un programa (muchos a muchos)
router.get("/programas/:id/docentes",               authMiddleware, docenteProgramaGuard, getProgramaDocentes);
router.post("/programas/:id/docentes",              authMiddleware, docenteProgramaGuard, addProgramaDocente);
router.delete("/programas/:id/docentes/:docenteId", authMiddleware, docenteProgramaGuard, removeProgramaDocente);

router.get("/programas/:id",          optionalAuthMiddleware, docenteProgramaGuard, getProgramaById);

// Enlace de inscripción (join link estilo Classroom)
router.get("/public/programas/join/:token", getJoinInfo); // pública, sin auth

// Enlace único legacy (compatibilidad — la UI ahora usa /join-links)
router.post("/programas/:id/join-link",     authMiddleware, docenteProgramaGuard, generateJoinLink);
router.patch("/programas/:id/join-link",    authMiddleware, docenteProgramaGuard, toggleJoinLink);

// Múltiples enlaces por coordinador (uno por coordinador por programa)
router.get("/programas/:id/join-links",                     authMiddleware, docenteProgramaGuard, listJoinLinks);
router.post("/programas/:id/join-links",                    authMiddleware, docenteProgramaGuard, createJoinLink);
router.patch("/programas/:id/join-links/:linkId",           authMiddleware, docenteProgramaGuard, setJoinLinkEnabled);
router.post("/programas/:id/join-links/:linkId/regenerate", authMiddleware, docenteProgramaGuard, regenerateJoinLink);
router.delete("/programas/:id/join-links/:linkId",          authMiddleware, docenteProgramaGuard, deleteJoinLink);

// Escritura: siempre requiere autenticación y business_id del token.
// createPrograma no lleva guard (no hay :id y un docente no crea programas nuevos;
// el frontend no lo expone). update/delete quedan scoped a los programas del docente.
router.post("/programas",        authMiddleware, createPrograma);
router.put("/programas/:id",     authMiddleware, docenteProgramaGuard, updatePrograma);
router.delete("/programas/:id",  authMiddleware, docenteProgramaGuard, deletePrograma);

export default router;
