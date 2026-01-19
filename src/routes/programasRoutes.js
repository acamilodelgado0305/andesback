// src/routes/programasRouter.js
import express from "express";
import {
  createPrograma,
  getProgramas,
  getProgramaById,
  updatePrograma,
  deletePrograma,
} from "../controllers/programasController.js";


import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Crear programa


router.get("/programas", getProgramas);
router.get("/programas/:id", getProgramaById);

// Listar programas (con filtros opcionales ?tipo_programa=...&activo=true/false)

router.post("/programas", createPrograma);
// Obtener programa por ID


// Actualizar programa
router.put("/programas/:id", updatePrograma);

// Desactivar programa (borrado lógico)
router.delete("/programas/:id", deletePrograma);

export default router;
