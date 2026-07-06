// src/controllers/programasController.js
import pool from "../database.js";
import crypto from "crypto";

// --- CREATE ---
export const createPrograma = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  const {
    nombre, tipo_programa, descripcion,
    duracion_meses, valor_matricula, valor_mensualidad, derechos_grado,
  } = req.body;

  if (!nombre || !tipo_programa) {
    return res.status(400).json({ message: "Los campos 'nombre' y 'tipo_programa' son obligatorios." });
  }

  try {
    const duracion    = Number(duracion_meses)    || 0;
    const mensualidad = Number(valor_mensualidad) || 0;
    const matricula   = Number(valor_matricula)   || 0;
    const grado       = Number(derechos_grado)    || 0;
    const monto_total = (duracion * mensualidad) + matricula + grado;

    const { rows } = await pool.query(
      `INSERT INTO programas (
        nombre, tipo_programa, descripcion,
        duracion_meses, valor_matricula, valor_mensualidad,
        derechos_grado, monto_total, activo, business_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)
      RETURNING *;`,
      [
        nombre.trim(), tipo_programa.trim(),
        descripcion ? descripcion.trim() : null,
        duracion, matricula, mensualidad, grado, monto_total,
        businessId,
      ]
    );

    return res.status(201).json({ message: "Programa creado correctamente.", data: rows[0] });
  } catch (err) {
    console.error("Error en createPrograma:", err);
    if (err.code === "23505") {
      return res.status(409).json({ message: "Ya existe un programa con ese nombre en este negocio." });
    }
    return res.status(500).json({ message: "Error interno al crear el programa." });
  }
};

// --- GET ALL ---
// Si hay token (admin panel) → filtra por business_id del token.
// Si no hay token (formularios públicos) → devuelve todos los activos.
export const getProgramas = async (req, res) => {
  // Prioridad: 1) token JWT (admin panel), 2) query param (formularios públicos)
  const businessId = req.user?.bid || req.query.business_id || null;
  const { tipo_programa, activo } = req.query;

  try {
    const conditions = [];
    const valores    = [];
    let idx = 1;

    if (businessId) {
      conditions.push(`business_id = $${idx++}`);
      valores.push(businessId);
    }

    if (tipo_programa) {
      conditions.push(`tipo_programa = $${idx++}`);
      valores.push(tipo_programa);
    }

    if (activo !== undefined) {
      conditions.push(`activo = $${idx++}`);
      valores.push(activo === "true");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT * FROM programas ${whereClause} ORDER BY nombre ASC;`,
      valores
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error en getProgramas:", err);
    return res.status(500).json({ message: "Error al obtener programas." });
  }
};

// --- GET BY ID ---
export const getProgramaById = async (req, res) => {
  const businessId = req.user?.bid;
  const { id }     = req.params;

  try {
    const conditions = ["id = $1"];
    const valores    = [id];

    if (businessId) {
      conditions.push("business_id = $2");
      valores.push(businessId);
    }

    const { rows } = await pool.query(
      `SELECT * FROM programas WHERE ${conditions.join(" AND ")};`,
      valores
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error en getProgramaById:", err);
    return res.status(500).json({ message: "Error al obtener el programa." });
  }
};

// --- UPDATE ---
export const updatePrograma = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  const { id } = req.params;
  const {
    nombre, tipo_programa, descripcion,
    duracion_meses, valor_matricula, valor_mensualidad, derechos_grado, activo,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE programas
       SET
         nombre            = COALESCE($1, nombre),
         tipo_programa     = COALESCE($2, tipo_programa),
         descripcion       = COALESCE($3, descripcion),
         duracion_meses    = COALESCE($4, duracion_meses),
         valor_matricula   = COALESCE($5, valor_matricula),
         valor_mensualidad = COALESCE($6, valor_mensualidad),
         derechos_grado    = COALESCE($7, derechos_grado),
         activo            = COALESCE($8, activo),
         monto_total = (
           (COALESCE($4, duracion_meses)    * COALESCE($6, valor_mensualidad)) +
            COALESCE($5, valor_matricula)   +
            COALESCE($7, derechos_grado)
         )
       WHERE id = $9 AND business_id = $10
       RETURNING *;`,
      [
        nombre ? nombre.trim() : null,
        tipo_programa ? tipo_programa.trim() : null,
        descripcion ? descripcion.trim() : null,
        duracion_meses    || null,
        valor_matricula   || null,
        valor_mensualidad || null,
        derechos_grado    || null,
        activo !== undefined ? activo : null,
        id,
        businessId,
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }
    return res.status(200).json({ message: "Programa actualizado correctamente.", data: rows[0] });
  } catch (err) {
    console.error("Error en updatePrograma:", err);
    if (err.code === "23505") {
      return res.status(409).json({ message: "Ya existe otro programa con ese nombre." });
    }
    return res.status(500).json({ message: "Error al actualizar el programa." });
  }
};

// --- GET DETALLE (programa + estudiantes + módulos + stats) ---
export const getProgramaDetalle = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    // Programa
    const { rows: progRows } = await pool.query(
      'SELECT * FROM programas WHERE id=$1 AND business_id=$2',
      [id, businessId]
    );
    if (!progRows.length) return res.status(404).json({ message: 'Programa no encontrado.' });

    // Estudiantes inscritos
    const { rows: estudiantes } = await pool.query(
      `SELECT s.id, s.nombre, s.apellido, s.email,
              s.telefono_whatsapp, s.telefono_llamadas,
              s.numero_documento, s.estado_matricula
       FROM estudiante_programas ep
       JOIN students s ON s.id = ep.estudiante_id
       WHERE ep.programa_id = $1
       ORDER BY s.nombre ASC`,
      [id]
    );

    // Módulos del programa (directos o a través de materia)
    const { rows: modulos } = await pool.query(
      `SELECT m.id, m.titulo, m.descripcion, m.activa, m.orden, m.created_at,
              m.materia_id,
              mat.nombre AS materia_nombre,
              (SELECT COUNT(*) FROM modulo_pdfs mp WHERE mp.modulo_id = m.id) AS total_pdfs,
              (SELECT COUNT(*) FROM modulo_evaluaciones me WHERE me.modulo_id = m.id) AS total_evaluaciones,
              (SELECT COUNT(*) FROM estudiante_modulos em WHERE em.modulo_id = m.id) AS total_asignados
       FROM modulos m
       LEFT JOIN materias mat ON mat.id = m.materia_id
       WHERE (m.programa_id = $1 OR mat.programa_id = $1) AND m.business_id = $2
       ORDER BY mat.nombre ASC NULLS LAST, m.orden ASC, m.created_at DESC`,
      [id, businessId]
    );

    return res.status(200).json({
      programa: progRows[0],
      estudiantes,
      modulos,
      stats: {
        total_estudiantes: estudiantes.length,
        total_modulos: modulos.length,
        activos: progRows[0].activo,
      },
    });
  } catch (err) {
    console.error('Error en getProgramaDetalle:', err);
    return res.status(500).json({ message: 'Error al obtener detalle del programa.' });
  }
};

// ================================================================
// DOCENTES DEL PROGRAMA (relación muchos a muchos)
// ================================================================

// --- GET docentes asociados a un programa ---
export const getProgramaDocentes = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.nombre_completo, d.email, d.especialidad,
              pd.created_at AS asociado_en
       FROM programa_docentes pd
       JOIN docentes d ON d.id = pd.docente_id
       WHERE pd.programa_id = $1 AND pd.business_id = $2
       ORDER BY d.nombre_completo ASC;`,
      [id, businessId]
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error("Error en getProgramaDocentes:", err);
    return res.status(500).json({ message: "Error al obtener los docentes del programa." });
  }
};

// --- POST asociar un docente a un programa ---
export const addProgramaDocente = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { docente_id } = req.body;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }
  if (!docente_id) {
    return res.status(400).json({ message: 'El campo "docente_id" es obligatorio.' });
  }

  try {
    // Verificar que el programa pertenece al negocio
    const { rows: prog } = await pool.query(
      "SELECT id FROM programas WHERE id = $1 AND business_id = $2;",
      [id, businessId]
    );
    if (!prog.length) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }

    // Verificar que el docente pertenece al negocio
    const { rows: doc } = await pool.query(
      "SELECT id FROM docentes WHERE id = $1 AND business_id = $2;",
      [docente_id, businessId]
    );
    if (!doc.length) {
      return res.status(404).json({ message: "Docente no encontrado." });
    }

    const { rows } = await pool.query(
      `INSERT INTO programa_docentes (programa_id, docente_id, business_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (programa_id, docente_id) DO NOTHING
       RETURNING *;`,
      [id, docente_id, businessId]
    );

    if (!rows.length) {
      return res.status(409).json({ message: "El docente ya está asociado a este programa." });
    }
    return res.status(201).json({ message: "Docente asociado correctamente.", data: rows[0] });
  } catch (err) {
    console.error("Error en addProgramaDocente:", err);
    return res.status(500).json({ message: "Error al asociar el docente al programa." });
  }
};

// --- DELETE quitar un docente de un programa ---
export const removeProgramaDocente = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, docenteId } = req.params;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM programa_docentes
       WHERE programa_id = $1 AND docente_id = $2 AND business_id = $3;`,
      [id, docenteId, businessId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: "Asociación no encontrada." });
    }
    return res.sendStatus(204);
  } catch (err) {
    console.error("Error en removeProgramaDocente:", err);
    return res.status(500).json({ message: "Error al quitar el docente del programa." });
  }
};

// ================================================================
// ENLACE DE INSCRIPCIÓN (join link estilo Classroom)
// ================================================================

// --- POST generar/regenerar el enlace de inscripción ---
export const generateJoinLink = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { coordinador_id } = req.body;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }
  if (!coordinador_id) {
    return res.status(400).json({ message: 'El campo "coordinador_id" es obligatorio.' });
  }

  try {
    const token = crypto.randomBytes(9).toString("base64url");

    const { rows } = await pool.query(
      `UPDATE programas
       SET join_token = $1, join_coordinador_id = $2, join_enabled = true
       WHERE id = $3 AND business_id = $4
       RETURNING id, join_token, join_enabled, join_coordinador_id;`,
      [token, coordinador_id, id, businessId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }
    return res.status(200).json({ message: "Enlace generado correctamente.", data: rows[0] });
  } catch (err) {
    console.error("Error en generateJoinLink:", err);
    return res.status(500).json({ message: "Error al generar el enlace de inscripción." });
  }
};

// --- PATCH activar/desactivar el enlace sin regenerarlo ---
export const toggleJoinLink = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { enabled } = req.body;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE programas
       SET join_enabled = $1
       WHERE id = $2 AND business_id = $3
       RETURNING id, join_token, join_enabled, join_coordinador_id;`,
      [!!enabled, id, businessId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }
    return res.status(200).json({ message: "Enlace actualizado correctamente.", data: rows[0] });
  } catch (err) {
    console.error("Error en toggleJoinLink:", err);
    return res.status(500).json({ message: "Error al actualizar el enlace de inscripción." });
  }
};

// --- GET info pública del programa a partir del token del enlace ---
export const getJoinInfo = async (req, res) => {
  const { token } = req.params;

  try {
    // 1) Enlaces por coordinador (tabla nueva).
    let { rows } = await pool.query(
      `SELECT p.id, p.nombre, p.tipo_programa, p.descripcion, p.duracion_meses
       FROM programa_join_links l
       JOIN programas p ON p.id = l.programa_id
       WHERE l.token = $1 AND l.enabled = true AND p.activo = true;`,
      [token]
    );

    // 2) Compatibilidad: enlace único legacy en la tabla programas.
    if (rows.length === 0) {
      ({ rows } = await pool.query(
        `SELECT id, nombre, tipo_programa, descripcion, duracion_meses
         FROM programas
         WHERE join_token = $1 AND join_enabled = true AND activo = true;`,
        [token]
      ));
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: "Enlace de inscripción inválido o inactivo." });
    }
    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error en getJoinInfo:", err);
    return res.status(500).json({ message: "Error al consultar el enlace de inscripción." });
  }
};

// ================================================================
// MÚLTIPLES ENLACES POR COORDINADOR (programa_join_links)
// ================================================================

// --- GET lista de enlaces de inscripción de un programa ---
export const listJoinLinks = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  try {
    const prog = await pool.query(
      `SELECT id FROM programas WHERE id = $1 AND business_id = $2;`,
      [id, businessId]
    );
    if (prog.rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }

    const { rows } = await pool.query(
      `SELECT id, programa_id, coordinador_id, token, enabled, created_at
       FROM programa_join_links
       WHERE programa_id = $1
       ORDER BY created_at ASC, id ASC;`,
      [id]
    );
    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error("Error en listJoinLinks:", err);
    return res.status(500).json({ message: "Error al listar los enlaces de inscripción." });
  }
};

// --- POST crear un enlace para un coordinador ---
export const createJoinLink = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { coordinador_id } = req.body;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }
  if (!coordinador_id) {
    return res.status(400).json({ message: 'El campo "coordinador_id" es obligatorio.' });
  }

  try {
    const prog = await pool.query(
      `SELECT id FROM programas WHERE id = $1 AND business_id = $2;`,
      [id, businessId]
    );
    if (prog.rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }

    const token = crypto.randomBytes(9).toString("base64url");
    const { rows } = await pool.query(
      `INSERT INTO programa_join_links (programa_id, business_id, coordinador_id, token, enabled)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, programa_id, coordinador_id, token, enabled, created_at;`,
      [id, businessId, coordinador_id, token]
    );
    return res.status(201).json({ message: "Enlace generado correctamente.", data: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Este coordinador ya tiene un enlace en este programa." });
    }
    console.error("Error en createJoinLink:", err);
    return res.status(500).json({ message: "Error al generar el enlace de inscripción." });
  }
};

// --- PATCH activar/desactivar un enlace específico ---
export const setJoinLinkEnabled = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, linkId } = req.params;
  const { enabled } = req.body;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE programa_join_links l
       SET enabled = $1
       FROM programas p
       WHERE l.id = $2 AND l.programa_id = $3 AND p.id = l.programa_id AND p.business_id = $4
       RETURNING l.id, l.programa_id, l.coordinador_id, l.token, l.enabled, l.created_at;`,
      [!!enabled, linkId, id, businessId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Enlace no encontrado." });
    }
    return res.status(200).json({ message: "Enlace actualizado correctamente.", data: rows[0] });
  } catch (err) {
    console.error("Error en setJoinLinkEnabled:", err);
    return res.status(500).json({ message: "Error al actualizar el enlace de inscripción." });
  }
};

// --- POST regenerar el token de un enlace específico ---
export const regenerateJoinLink = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, linkId } = req.params;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  try {
    const token = crypto.randomBytes(9).toString("base64url");
    const { rows } = await pool.query(
      `UPDATE programa_join_links l
       SET token = $1, enabled = TRUE
       FROM programas p
       WHERE l.id = $2 AND l.programa_id = $3 AND p.id = l.programa_id AND p.business_id = $4
       RETURNING l.id, l.programa_id, l.coordinador_id, l.token, l.enabled, l.created_at;`,
      [token, linkId, id, businessId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Enlace no encontrado." });
    }
    return res.status(200).json({ message: "Enlace regenerado correctamente.", data: rows[0] });
  } catch (err) {
    console.error("Error en regenerateJoinLink:", err);
    return res.status(500).json({ message: "Error al regenerar el enlace de inscripción." });
  }
};

// --- DELETE eliminar un enlace específico ---
export const deleteJoinLink = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, linkId } = req.params;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  try {
    const { rows } = await pool.query(
      `DELETE FROM programa_join_links l
       USING programas p
       WHERE l.id = $1 AND l.programa_id = $2 AND p.id = l.programa_id AND p.business_id = $3
       RETURNING l.id;`,
      [linkId, id, businessId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Enlace no encontrado." });
    }
    return res.status(200).json({ message: "Enlace eliminado correctamente." });
  } catch (err) {
    console.error("Error en deleteJoinLink:", err);
    return res.status(500).json({ message: "Error al eliminar el enlace de inscripción." });
  }
};

// --- DELETE (soft) ---
export const deletePrograma = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE programas
       SET activo = false
       WHERE id = $1 AND business_id = $2
       RETURNING id, nombre, activo;`,
      [id, businessId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }
    return res.status(200).json({ message: "Programa desactivado correctamente.", data: rows[0] });
  } catch (err) {
    console.error("Error en deletePrograma:", err);
    return res.status(500).json({ message: "Error al desactivar el programa." });
  }
};
