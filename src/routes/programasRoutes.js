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
router.post("/programs", createPrograma);

// Listar programas (con filtros opcionales ?tipo_programa=...&activo=true/false)
router.get("/programs", getProgramas);

// Obtener programa por ID
router.get("/programs/:id", getProgramaById);

// Actualizar programa
router.put("/programs/:id", updatePrograma);

// Desactivar programa (borrado lógico)
router.delete("/programs/:id", deletePrograma);

export default router;
