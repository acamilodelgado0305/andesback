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
router.post("/", createPrograma);

// Listar programas (con filtros opcionales ?tipo_programa=...&activo=true/false)
router.get("/", getProgramas);

// Obtener programa por ID
router.get("/:id", getProgramaById);

// Actualizar programa
router.put("/:id", updatePrograma);

// Desactivar programa (borrado lógico)
router.delete("/:id", deletePrograma);

export default router;
