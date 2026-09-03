// src/controllers/studentSelfController.js
// =============================================================================
// AUTOSERVICIO DEL ESTUDIANTE (portal /student-portal)
// El estudiante gestiona SUS PROPIOS datos: ve y edita sus datos personales,
// sube su foto de perfil y carga sus documentos en PDF.
//
// Regla de oro de seguridad: el id SIEMPRE sale del token (req.student.id),
// nunca de la URL ni del body. Así un estudiante no puede tocar el registro
// de otro aunque manipule la petición.
// =============================================================================
import pool from '../database.js';
import {
  uploadStudentDocumentToGCS,
  deleteStudentDocumentFromGCS,
} from '../services/gcsStudentDocuments.js';

// Campos que el estudiante SÍ puede cambiar por su cuenta: datos de contacto,
// salud y acudiente. Quedan fuera a propósito nombre, apellido, tipo/número de
// documento (son su identidad legal, se imprimen en diplomas y el número es su
// usuario de acceso), el estado y los programas: eso lo corrige la secretaría.
const CAMPOS_EDITABLES = [
  'email',
  'telefono',
  'telefono_llamadas',
  'telefono_whatsapp',
  'fecha_nacimiento',
  'lugar_nacimiento',
  'lugar_expedicion',
  'eps',
  'rh',
  'nombre_acudiente',
  'tipo_documento_acudiente',
  'telefono_acudiente',
  'direccion_acudiente',
];

// SELECT del perfil personal. `fecha_nacimiento` se devuelve como texto
// 'YYYY-MM-DD' a propósito: si se deja como DATE, pg lo convierte a Date y el
// front lo lee en UTC mostrando un día antes.
const SELECT_PERFIL = `
  SELECT s.id, s.nombre, s.apellido,
         CAST(s.numero_documento AS TEXT) AS numero_documento,
         s.tipo_documento, s.email, s.telefono,
         s.telefono_llamadas, s.telefono_whatsapp,
         TO_CHAR(s.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
         s.lugar_nacimiento, s.lugar_expedicion,
         s.eps, s.rh,
         s.nombre_acudiente, s.tipo_documento_acudiente,
         s.telefono_acudiente, s.direccion_acudiente,
         s.foto_url, s.activo, s.business_id,
         s.modalidad_estudio
    FROM students s
   WHERE s.id = $1
   LIMIT 1;
`;

const fetchPerfil = async (studentId) => {
  const { rows } = await pool.query(SELECT_PERFIL, [studentId]);
  return rows[0] || null;
};

const handleError = (res, err, mensaje) => {
  console.error(`${mensaje}:`, err);
  return res.status(500).json({ ok: false, error: mensaje });
};

// ── PERFIL ───────────────────────────────────────────────────────────────────

// GET /api/student-portal/me/perfil
export const getMiPerfil = async (req, res) => {
  const studentId = req.student?.id;
  if (!studentId) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });

  try {
    const perfil = await fetchPerfil(studentId);
    if (!perfil) return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });

    return res.json({ ok: true, perfil, camposEditables: CAMPOS_EDITABLES });
  } catch (err) {
    return handleError(res, err, 'Error al obtener tus datos personales.');
  }
};

// PUT /api/student-portal/me/perfil
export const updateMiPerfil = async (req, res) => {
  const studentId = req.student?.id;
  if (!studentId) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });

  const setClauses = [];
  const params = [];
  let idx = 1;

  for (const campo of CAMPOS_EDITABLES) {
    if (!Object.prototype.hasOwnProperty.call(req.body, campo)) continue;

    let valor = req.body[campo];
    if (valor === undefined) continue;
    if (typeof valor === 'string') valor = valor.trim();
    // Cadena vacía = "lo dejo en blanco" → NULL, para no guardar '' en la BD.
    if (valor === '') valor = null;

    setClauses.push(`${campo} = $${idx}`);
    params.push(valor);
    idx += 1;
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ ok: false, error: 'No enviaste ningún dato para actualizar.' });
  }

  if (req.body.email !== undefined) {
    const email = String(req.body.email || '').trim();
    // El correo es obligatorio en la tabla: no dejamos que lo borre.
    if (!email) {
      return res.status(400).json({ ok: false, error: 'El correo electrónico no puede quedar vacío.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'El correo electrónico no es válido.' });
    }
  }

  params.push(studentId);

  try {
    const { rowCount } = await pool.query(
      `UPDATE students
          SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${idx}`,
      params
    );
    if (rowCount === 0) return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });

    const perfil = await fetchPerfil(studentId);
    return res.json({ ok: true, message: 'Tus datos se actualizaron correctamente.', perfil });
  } catch (err) {
    return handleError(res, err, 'Error al actualizar tus datos personales.');
  }
};

// ── FOTO DE PERFIL ───────────────────────────────────────────────────────────

// POST /api/student-portal/me/foto  (multipart, campo "foto")
export const uploadMiFoto = async (req, res) => {
  const studentId = req.student?.id;
  if (!studentId) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se envió ninguna imagen.' });

  try {
    const { rows } = await pool.query('SELECT foto_gcs_path FROM students WHERE id = $1', [studentId]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });

    const { buffer, originalname, mimetype } = req.file;
    const { publicUrl, gcsPath } = await uploadStudentDocumentToGCS(buffer, {
      filename: originalname,
      mimetype,
      studentId,
    });

    // La foto anterior se borra después de subir la nueva: si el borrado falla,
    // el estudiante igual se queda con su foto nueva.
    if (rows[0].foto_gcs_path) {
      await deleteStudentDocumentFromGCS(rows[0].foto_gcs_path).catch((e) =>
        console.warn('[GCS] No se pudo eliminar la foto anterior:', e.message)
      );
    }

    await pool.query(
      `UPDATE students
          SET foto_url = $1, foto_gcs_path = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [publicUrl, gcsPath, studentId]
    );

    return res.json({ ok: true, message: 'Foto actualizada correctamente.', foto_url: publicUrl });
  } catch (err) {
    return handleError(res, err, 'Error al subir tu foto de perfil.');
  }
};

// DELETE /api/student-portal/me/foto
export const deleteMiFoto = async (req, res) => {
  const studentId = req.student?.id;
  if (!studentId) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });

  try {
    const { rows } = await pool.query('SELECT foto_gcs_path FROM students WHERE id = $1', [studentId]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });

    if (rows[0].foto_gcs_path) {
      await deleteStudentDocumentFromGCS(rows[0].foto_gcs_path).catch((e) =>
        console.warn('[GCS] No se pudo eliminar la foto:', e.message)
      );
    }

    await pool.query(
      `UPDATE students
          SET foto_url = NULL, foto_gcs_path = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [studentId]
    );

    return res.json({ ok: true, message: 'Foto eliminada correctamente.' });
  } catch (err) {
    return handleError(res, err, 'Error al eliminar tu foto de perfil.');
  }
};

// ── MIS DOCUMENTOS (PDF) ─────────────────────────────────────────────────────

// GET /api/student-portal/me/documentos
export const listMisDocumentos = async (req, res) => {
  const studentId = req.student?.id;
  if (!studentId) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });

  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, tipo, url, subido_por, created_at
         FROM student_documentos
        WHERE student_id = $1
        ORDER BY created_at DESC`,
      [studentId]
    );
    return res.json({ ok: true, documentos: rows });
  } catch (err) {
    return handleError(res, err, 'Error al obtener tus documentos.');
  }
};

// POST /api/student-portal/me/documentos  (multipart, campo "documento")
export const uploadMiDocumento = async (req, res) => {
  const studentId = req.student?.id;
  if (!studentId) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se envió ningún archivo PDF.' });

  const tipo = String(req.body?.tipo || '').trim().slice(0, 60) || null;
  const nombrePersonalizado = String(req.body?.nombre || '').trim().slice(0, 255);

  try {
    const { rows } = await pool.query('SELECT business_id FROM students WHERE id = $1', [studentId]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });

    const { buffer, originalname, mimetype } = req.file;
    const { publicUrl, gcsPath } = await uploadStudentDocumentToGCS(buffer, {
      filename: originalname,
      mimetype,
      studentId,
    });

    const insert = await pool.query(
      `INSERT INTO student_documentos
         (student_id, business_id, nombre, tipo, url, gcs_path, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, 'estudiante')
       RETURNING id, nombre, tipo, url, subido_por, created_at`,
      [studentId, rows[0].business_id, nombrePersonalizado || originalname, tipo, publicUrl, gcsPath]
    );

    return res.status(201).json({
      ok: true,
      message: 'Documento cargado correctamente.',
      documento: insert.rows[0],
    });
  } catch (err) {
    return handleError(res, err, 'Error al cargar tu documento.');
  }
};

// DELETE /api/student-portal/me/documentos/:documentoId
export const deleteMiDocumento = async (req, res) => {
  const studentId = req.student?.id;
  const { documentoId } = req.params;
  if (!studentId) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });
  if (!documentoId || isNaN(documentoId)) {
    return res.status(400).json({ ok: false, error: 'Documento inválido.' });
  }

  try {
    // El WHERE incluye student_id: solo puede borrar documentos suyos.
    const { rows } = await pool.query(
      'SELECT gcs_path FROM student_documentos WHERE id = $1 AND student_id = $2',
      [documentoId, studentId]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, error: 'Documento no encontrado.' });

    if (rows[0].gcs_path) {
      await deleteStudentDocumentFromGCS(rows[0].gcs_path).catch((e) =>
        console.warn('[GCS] No se pudo eliminar el documento:', e.message)
      );
    }

    await pool.query('DELETE FROM student_documentos WHERE id = $1 AND student_id = $2', [
      documentoId,
      studentId,
    ]);

    return res.json({ ok: true, message: 'Documento eliminado correctamente.' });
  } catch (err) {
    return handleError(res, err, 'Error al eliminar tu documento.');
  }
};

// ── ADMIN: ver los documentos que cargó el estudiante ────────────────────────
// GET /api/students/:id/documentos  (authMiddleware)
export const getStudentDocumentosAdmin = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID de estudiante inválido o no proporcionado.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, tipo, url, subido_por, created_at
         FROM student_documentos
        WHERE student_id = $1
        ORDER BY created_at DESC`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Error al obtener los documentos del estudiante:', err);
    return res.status(500).json({ error: 'Error al obtener los documentos del estudiante.' });
  }
};
