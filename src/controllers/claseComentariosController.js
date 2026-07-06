// src/controllers/claseComentariosController.js
// Comentarios/discusión de una clase. Participan admin, docentes y estudiantes
// (todos ven y escriben). Soporta respuestas anidadas (parent_id). Usa
// flexAuthMiddleware: token admin -> req.user, token estudiante -> req.student.
import pool from '../database.js';

// Carga la clase (id, business_id, modulo_id). null si no existe.
const getClaseBasica = async (claseId) => {
  const { rows } = await pool.query(
    'SELECT id, business_id, modulo_id FROM clases WHERE id = $1',
    [claseId]
  );
  return rows[0] || null;
};

// El estudiante tiene acceso a la clase si tiene acceso a su tema (modulo).
const estudianteTieneAcceso = async (estudianteId, moduloId) => {
  const { rows } = await pool.query(
    'SELECT 1 FROM estudiante_modulos WHERE modulo_id = $1 AND estudiante_id = $2 LIMIT 1',
    [moduloId, estudianteId]
  );
  return rows.length > 0;
};

// Autoriza al solicitante (admin/docente o estudiante) sobre la clase.
// Devuelve { ok:true } o { ok:false, status, message }.
const autorizarSobreClase = async (req, clase) => {
  if (req.user) {
    if (clase.business_id && req.user.bid && clase.business_id !== req.user.bid) {
      return { ok: false, status: 403, message: 'Clase de otro negocio.' };
    }
    return { ok: true };
  }
  if (req.student) {
    const acceso = await estudianteTieneAcceso(req.student.id, clase.modulo_id);
    if (!acceso) return { ok: false, status: 403, message: 'No tienes acceso a esta clase.' };
    return { ok: true };
  }
  return { ok: false, status: 401, message: 'No autorizado.' };
};

// ─── GET /api/clases/:claseId/comentarios ────────────────────────────────────
export const getComentariosByClase = async (req, res) => {
  const { claseId } = req.params;

  try {
    const clase = await getClaseBasica(claseId);
    if (!clase) return res.status(404).json({ ok: false, message: 'Clase no encontrada.' });

    const auth = await autorizarSobreClase(req, clase);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, message: auth.message });

    const { rows } = await pool.query(
      `SELECT id, clase_id, parent_id, autor_tipo, autor_id, autor_nombre,
              contenido, created_at, updated_at
         FROM clase_comentarios
        WHERE clase_id = $1
        ORDER BY created_at ASC`,
      [claseId]
    );

    // Armar hilos: comentarios padre con respuestas[]
    const porId = new Map();
    rows.forEach((c) => porId.set(c.id, { ...c, respuestas: [] }));
    const hilos = [];
    rows.forEach((c) => {
      if (c.parent_id && porId.has(c.parent_id)) {
        porId.get(c.parent_id).respuestas.push(porId.get(c.id));
      } else if (!c.parent_id) {
        hilos.push(porId.get(c.id));
      }
    });

    // El viewer permite a la UI saber qué comentarios puede borrar (los suyos).
    const viewer = req.user
      ? { tipo: req.user.role === 'docente' ? 'docente' : 'admin', id: req.user.id }
      : { tipo: 'estudiante', id: req.student.id };

    return res.json({ ok: true, comentarios: hilos, viewer });
  } catch (err) {
    console.error('Error en getComentariosByClase:', err);
    return res.status(500).json({ ok: false, message: 'Error al obtener los comentarios.' });
  }
};

// ─── POST /api/clases/:claseId/comentarios ───────────────────────────────────
export const createComentario = async (req, res) => {
  const { claseId } = req.params;
  const { contenido, parent_id } = req.body;

  if (!contenido?.trim()) {
    return res.status(400).json({ ok: false, message: 'Escribe un comentario.' });
  }

  try {
    const clase = await getClaseBasica(claseId);
    if (!clase) return res.status(404).json({ ok: false, message: 'Clase no encontrada.' });

    const auth = await autorizarSobreClase(req, clase);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, message: auth.message });

    let autor_tipo;
    let autor_id;
    let autor_nombre;

    if (req.user) {
      autor_tipo = req.user.role === 'docente' ? 'docente' : 'admin';
      autor_id = req.user.id || null;
      autor_nombre = req.user.name || (autor_tipo === 'docente' ? 'Docente' : 'Administrador');
    } else {
      autor_tipo = 'estudiante';
      autor_id = req.student.id;
      const { rows: est } = await pool.query(
        'SELECT nombre, apellido FROM students WHERE id = $1',
        [req.student.id]
      );
      autor_nombre = est.length
        ? `${est[0].nombre || ''} ${est[0].apellido || ''}`.trim() || 'Estudiante'
        : 'Estudiante';
    }

    // Si es respuesta, el parent debe pertenecer a la misma clase.
    let parentId = null;
    if (parent_id) {
      const { rows: parent } = await pool.query(
        'SELECT id FROM clase_comentarios WHERE id = $1 AND clase_id = $2',
        [parent_id, claseId]
      );
      if (!parent.length) {
        return res.status(400).json({ ok: false, message: 'El comentario al que respondes no existe.' });
      }
      parentId = parent_id;
    }

    const { rows } = await pool.query(
      `INSERT INTO clase_comentarios
         (clase_id, business_id, parent_id, autor_tipo, autor_id, autor_nombre, contenido)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, clase_id, parent_id, autor_tipo, autor_id, autor_nombre, contenido, created_at, updated_at;`,
      [claseId, clase.business_id, parentId, autor_tipo, autor_id, autor_nombre, contenido.trim()]
    );

    return res.status(201).json({ ok: true, comentario: { ...rows[0], respuestas: [] } });
  } catch (err) {
    console.error('Error en createComentario:', err);
    return res.status(500).json({ ok: false, message: 'Error al publicar el comentario.' });
  }
};

// ─── DELETE /api/clase-comentarios/:comentarioId ─────────────────────────────
export const deleteComentario = async (req, res) => {
  const { comentarioId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT id, business_id, autor_tipo, autor_id FROM clase_comentarios WHERE id = $1',
      [comentarioId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Comentario no encontrado.' });
    const comentario = rows[0];

    if (req.user) {
      // Admin/docente: solo dentro de su negocio.
      if (comentario.business_id && req.user.bid && comentario.business_id !== req.user.bid) {
        return res.status(403).json({ ok: false, message: 'No puedes borrar comentarios de otro negocio.' });
      }
    } else if (req.student) {
      // Estudiante: solo sus propios comentarios.
      if (comentario.autor_tipo !== 'estudiante' || Number(comentario.autor_id) !== Number(req.student.id)) {
        return res.status(403).json({ ok: false, message: 'Solo puedes borrar tus propios comentarios.' });
      }
    } else {
      return res.status(401).json({ ok: false, message: 'No autorizado.' });
    }

    // Las respuestas se borran en cascada (ON DELETE CASCADE por parent_id).
    await pool.query('DELETE FROM clase_comentarios WHERE id = $1', [comentarioId]);
    return res.json({ ok: true, message: 'Comentario eliminado.' });
  } catch (err) {
    console.error('Error en deleteComentario:', err);
    return res.status(500).json({ ok: false, message: 'Error al eliminar el comentario.' });
  }
};
