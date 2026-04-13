// src/routes/programasRouter.js
import express from "express";
import {
  createPrograma,
  getProgramas,
  getProgramaById,
  updatePrograma,
  deletePrograma,
} from "../controllers/programasController.js";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET: optionalAuth — si hay token filtra por business, si no devuelve todos (formularios públicos)
router.get("/programas",     optionalAuthMiddleware, getProgramas);
router.get("/programas/:id", optionalAuthMiddleware, getProgramaById);

// Escritura: siempre requiere autenticación y business_id del token
router.post("/programas",        authMiddleware, createPrograma);
router.put("/programas/:id",     authMiddleware, updatePrograma);
router.delete("/programas/:id",  authMiddleware, deletePrograma);

export default router;
