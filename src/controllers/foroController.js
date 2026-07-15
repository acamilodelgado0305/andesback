// src/controllers/foroController.js
// Foro de la materia (estilo aula Teams). Participan admin, docentes y
// estudiantes. Usa flexAuthMiddleware: token admin -> req.user, token
// estudiante -> req.student.
import pool from '../database.js';
import { uploadForoAdjuntoToGCS, deleteForoAdjuntoFromGCS } from '../services/gcsForoAdjuntos.js';

// Verifica que el estudiante esté inscrito en el programa de la materia.
const estudianteInscritoEnMateria = async (estudianteId, materiaId) => {
  const { rows } = await pool.query(
    `SELECT 1
       FROM materias m
       JOIN estudiante_programas ep ON ep.programa_id = m.programa_id
      WHERE m.id = $1 AND ep.estudiante_id = $2
      LIMIT 1`,
    [materiaId, estudianteId]
  );
  return rows.length > 0;
};

// Carga la materia (id, business_id, programa_id). null si no existe.
const getMateriaBasica = async (materiaId) => {
  const { rows } = await pool.query(
    'SELECT id, business_id, programa_id FROM materias WHERE id = $1',
    [materiaId]
  );
  return rows[0] || null;
};

// ─── GET /api/materias/:materiaId/foro ───────────────────────────────────────
export const getPostsByMateria = async (req, res) => {
  const { materiaId } = req.params;

  try {
    const materia = await getMateriaBasica(materiaId);
    if (!materia) return res.status(404).json({ ok: false, message: 'Materia no encontrada.' });

    // Autorización por tipo de token
    if (req.user) {
      if (materia.business_id && req.user.bid && materia.business_id !== req.user.bid) {
        return res.status(403).json({ ok: false, message: 'Materia de otro negocio.' });
      }
    } else if (req.student) {
      const inscrito = await estudianteInscritoEnMateria(req.student.id, materiaId);
      if (!inscrito) return res.status(403).json({ ok: false, message: 'No estás inscrito en esta materia.' });
    } else {
      return res.status(401).json({ ok: false, message: 'No autorizado.' });
    }

    const { rows } = await pool.query(
      `SELECT id, materia_id, parent_id, autor_tipo, autor_id, autor_nombre,
              contenido, created_at, updated_at
         FROM materia_foro_posts
        WHERE materia_id = $1
        ORDER BY created_at ASC`,
      [materiaId]
    );

    const { rows: adjuntos } = rows.length
      ? await pool.query(
          `SELECT id, post_id, tipo, nombre, url
             FROM materia_foro_adjuntos
            WHERE post_id = ANY($1::int[])
            ORDER BY id ASC`,
          [rows.map((p) => p.id)]
        )
      : { rows: [] };
    const adjuntosPorPost = new Map();
    adjuntos.forEach((a) => {
      if (!adjuntosPorPost.has(a.post_id)) adjuntosPorPost.set(a.post_id, []);
      adjuntosPorPost.get(a.post_id).push(a);
    });

    // Armar hilos: padres con respuestas[]
    const porId = new Map();
    rows.forEach((p) => porId.set(p.id, { ...p, adjuntos: adjuntosPorPost.get(p.id) || [], respuestas: [] }));
    const hilos = [];
    rows.forEach((p) => {
      if (p.parent_id && porId.has(p.parent_id)) {
        porId.get(p.parent_id).respuestas.push(porId.get(p.id));
      } else if (!p.parent_id) {
        hilos.push(porId.get(p.id));
      }
    });

    // Publicaciones (hilos) más recientes primero; las respuestas de cada hilo se
    // mantienen en orden cronológico (ascendente, como se construyeron arriba).
    hilos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // El estudiante actual solo puede borrar lo suyo; lo informamos para la UI
    const viewer = req.user
      ? { tipo: 'admin', id: req.user.id }
      : { tipo: 'estudiante', id: req.student.id };

    return res.json({ ok: true, posts: hilos, viewer });
  } catch (err) {
    console.error('Error en getPostsByMateria:', err);
    return res.status(500).json({ ok: false, message: 'Error al obtener el foro.' });
  }
};

// ─── POST /api/materias/:materiaId/foro ──────────────────────────────────────
export const createPost = async (req, res) => {
  const { materiaId } = req.params;
  const { contenido, parent_id, enlaces } = req.body;
  const archivos = req.files || [];

  let enlacesParsed = [];
  if (enlaces) {
    try {
      enlacesParsed = typeof enlaces === 'string' ? JSON.parse(enlaces) : enlaces;
      if (!Array.isArray(enlacesParsed)) enlacesParsed = [];
    } catch { enlacesParsed = []; }
  }
  enlacesParsed = enlacesParsed
    .filter((e) => e && e.url && e.url.trim())
    .map((e) => ({ url: e.url.trim(), titulo: (e.titulo || '').trim() || e.url.trim() }));

  if (!contenido?.trim() && !archivos.length && !enlacesParsed.length) {
    return res.status(400).json({ ok: false, message: 'Escribe un mensaje o agrega un adjunto.' });
  }

  try {
    const materia = await getMateriaBasica(materiaId);
    if (!materia) return res.status(404).json({ ok: false, message: 'Materia no encontrada.' });

    let autor_tipo, autor_id, autor_nombre;

    if (req.user) {
      if (materia.business_id && req.user.bid && materia.business_id !== req.user.bid) {
        return res.status(403).json({ ok: false, message: 'Materia de otro negocio.' });
      }
      autor_tipo = req.user.role === 'docente' ? 'docente' : 'admin';
      autor_id = req.user.id || null;
      autor_nombre = req.user.name || (autor_tipo === 'docente' ? 'Docente' : 'Administrador');
    } else if (req.student) {
      const inscrito = await estudianteInscritoEnMateria(req.student.id, materiaId);
      if (!inscrito) return res.status(403).json({ ok: false, message: 'No estás inscrito en esta materia.' });
      autor_tipo = 'estudiante';
      autor_id = req.student.id;
      const { rows: est } = await pool.query(
        'SELECT nombre, apellido FROM students WHERE id = $1',
        [req.student.id]
      );
      autor_nombre = est.length
        ? `${est[0].nombre || ''} ${est[0].apellido || ''}`.trim() || 'Estudiante'
        : 'Estudiante';
    } else {
      return res.status(401).json({ ok: false, message: 'No autorizado.' });
    }

    // Si es respuesta, validar que el parent pertenezca a la misma materia
    let parentId = null;
    if (parent_id) {
      const { rows: parent } = await pool.query(
        'SELECT id FROM materia_foro_posts WHERE id = $1 AND materia_id = $2',
        [parent_id, materiaId]
      );
      if (!parent.length) {
        return res.status(400).json({ ok: false, message: 'El mensaje al que respondes no existe.' });
      }
      parentId = parent_id;
    }

    const { rows } = await pool.query(
      `INSERT INTO materia_foro_posts
         (materia_id, business_id, parent_id, autor_tipo, autor_id, autor_nombre, contenido)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [materiaId, materia.business_id, parentId, autor_tipo, autor_id, autor_nombre, contenido?.trim() || '']
    );
    const post = rows[0];

    const adjuntosCreados = [];

    for (const file of archivos) {
      const { publicUrl, gcsPath } = await uploadForoAdjuntoToGCS(file.buffer, {
        filename: file.originalname,
        mimetype: file.mimetype,
        postId: post.id,
      });
      const { rows: adj } = await pool.query(
        `INSERT INTO materia_foro_adjuntos (post_id, business_id, tipo, nombre, url, gcs_path)
         VALUES ($1, $2, 'archivo', $3, $4, $5) RETURNING id, post_id, tipo, nombre, url`,
        [post.id, materia.business_id, file.originalname, publicUrl, gcsPath]
      );
      adjuntosCreados.push(adj[0]);
    }

    for (const enlace of enlacesParsed) {
      const { rows: adj } = await pool.query(
        `INSERT INTO materia_foro_adjuntos (post_id, business_id, tipo, nombre, url)
         VALUES ($1, $2, 'enlace', $3, $4) RETURNING id, post_id, tipo, nombre, url`,
        [post.id, materia.business_id, enlace.titulo, enlace.url]
      );
      adjuntosCreados.push(adj[0]);
    }

    return res.status(201).json({ ok: true, post: { ...post, adjuntos: adjuntosCreados } });
  } catch (err) {
    console.error('Error en createPost:', err);
    return res.status(500).json({ ok: false, message: 'Error al publicar en el foro.' });
  }
};

// ─── DELETE /api/foro/:postId ────────────────────────────────────────────────
export const deletePost = async (req, res) => {
  const { postId } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT id, business_id, autor_tipo, autor_id FROM materia_foro_posts WHERE id = $1',
      [postId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Mensaje no encontrado.' });
    const post = rows[0];

    if (req.user) {
      // Admin/docente: solo dentro de su negocio
      if (post.business_id && req.user.bid && post.business_id !== req.user.bid) {
        return res.status(403).json({ ok: false, message: 'No puedes borrar mensajes de otro negocio.' });
      }
    } else if (req.student) {
      // Estudiante: solo sus propios mensajes
      if (post.autor_tipo !== 'estudiante' || Number(post.autor_id) !== Number(req.student.id)) {
        return res.status(403).json({ ok: false, message: 'Solo puedes borrar tus propios mensajes.' });
      }
    } else {
      return res.status(401).json({ ok: false, message: 'No autorizado.' });
    }

    const { rows: adjuntos } = await pool.query(
      `SELECT gcs_path FROM materia_foro_adjuntos WHERE post_id = $1 AND gcs_path IS NOT NULL`,
      [postId]
    );
    await Promise.all(
      adjuntos.map((a) => deleteForoAdjuntoFromGCS(a.gcs_path).catch(() => {}))
    );

    await pool.query('DELETE FROM materia_foro_posts WHERE id = $1', [postId]);
    return res.json({ ok: true, message: 'Mensaje eliminado.' });
  } catch (err) {
    console.error('Error en deletePost:', err);
    return res.status(500).json({ ok: false, message: 'Error al eliminar el mensaje.' });
  }
};
