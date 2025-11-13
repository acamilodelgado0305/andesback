// src/routes/programasRouter.js
import express from "express";
import {
  createPrograma,
  getProgramas,
  getProgramaById,
  updatePrograma,
  deletePrograma,
} from "../controllers/programasController.js";

const router = express.Router();

// Crear programa
router.post("/programas", createPrograma);

// Listar programas (con filtros opcionales ?tipo_programa=...&activo=true/false)
router.get("/programas", getProgramas);

// Obtener programa por ID
router.get("/programas/:id", getProgramaById);

// Actualizar programa
router.put("/programas/:id", updatePrograma);

// Desactivar programa (borrado lógico)
router.delete("/programas/:id", deletePrograma);

export default router;
