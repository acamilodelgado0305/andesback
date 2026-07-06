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
} from "../controllers/programasController.js";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET: optionalAuth — si hay token filtra por business, si no devuelve todos (formularios públicos)
router.get("/programas",              optionalAuthMiddleware, getProgramas);
router.get("/programas/:id/detalle",  authMiddleware, getProgramaDetalle);   // detalle completo admin

// Docentes asociados a un programa (muchos a muchos)
router.get("/programas/:id/docentes",               authMiddleware, getProgramaDocentes);
router.post("/programas/:id/docentes",              authMiddleware, addProgramaDocente);
router.delete("/programas/:id/docentes/:docenteId", authMiddleware, removeProgramaDocente);

router.get("/programas/:id",          optionalAuthMiddleware, getProgramaById);

// Enlace de inscripción (join link estilo Classroom)
router.get("/public/programas/join/:token", getJoinInfo); // pública, sin auth
router.post("/programas/:id/join-link",     authMiddleware, generateJoinLink);
router.patch("/programas/:id/join-link",    authMiddleware, toggleJoinLink);

// Escritura: siempre requiere autenticación y business_id del token
router.post("/programas",        authMiddleware, createPrograma);
router.put("/programas/:id",     authMiddleware, updatePrograma);
router.delete("/programas/:id",  authMiddleware, deletePrograma);

export default router;
