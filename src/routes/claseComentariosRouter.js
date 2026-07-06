// src/routes/claseComentariosRouter.js
import express from 'express';
import { flexAuthMiddleware } from '../middlewares/flexAuthMiddleware.js';
import {
  getComentariosByClase,
  createComentario,
  deleteComentario,
} from '../controllers/claseComentariosController.js';

const router = express.Router();

// Comentarios de una clase — accesibles por admin/docente (token admin) y
// estudiante (token portal). Todos ven y escriben; cada quien borra lo suyo
// (el admin borra cualquiera de su negocio).
router.get('/clases/:claseId/comentarios', flexAuthMiddleware, getComentariosByClase);
router.post('/clases/:claseId/comentarios', flexAuthMiddleware, createComentario);
router.delete('/clase-comentarios/:comentarioId', flexAuthMiddleware, deleteComentario);

export default router;
