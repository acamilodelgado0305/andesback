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
    intensidad_horaria,
  } = req.body;

  if (!nombre || !tipo_programa) {
    return res.status(400).json({ message: "Los campos 'nombre' y 'tipo_programa' son obligatorios." });
  }

  try {
    const duracion    = Number(duracion_meses)    || 0;
    const mensualidad = Number(valor_mensualidad) || 0;
    const matricula   = Number(valor_matricula)   || 0;
    const grado       = Number(derechos_grado)    || 0;
    const horas       = intensidad_horaria !== undefined && intensidad_horaria !== null && intensidad_horaria !== ''
      ? Number(intensidad_horaria)
      : null;
    const monto_total = (duracion * mensualidad) + matricula + grado;

    const { rows } = await pool.query(
      `INSERT INTO programas (
        nombre, tipo_programa, descripcion,
        duracion_meses, valor_matricula, valor_mensualidad,
        derechos_grado, intensidad_horaria, monto_total, activo, business_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
      RETURNING *;`,
      [
        nombre.trim(), tipo_programa.trim(),
        descripcion ? descripcion.trim() : null,
        duracion, matricula, mensualidad, grado, horas, monto_total,
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
  const isDocente = req.user?.role === "docente";

  try {
    const conditions = [];
    const valores    = [];
    let idx = 1;

    if (businessId) {
      conditions.push(`business_id = $${idx++}`);
      valores.push(businessId);
    }

    // Un docente solo ve los programas donde dicta (defensa en profundidad; el
    // frontend usa GET /api/docentes/me/programas, pero este endpoint no debe
    // filtrar de más).
    if (isDocente) {
      conditions.push(`id IN (
        SELECT pd.programa_id FROM programa_docentes pd
        JOIN docentes d ON d.id = pd.docente_id
        WHERE d.user_id = $${idx++} AND pd.business_id = $${idx++}
      )`);
      valores.push(req.user.id, businessId);
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
      `SELECT p.*,
              (SELECT COUNT(*)
                 FROM estudiante_programas ep
                 JOIN students s ON s.id = ep.estudiante_id
                WHERE ep.programa_id = p.id
                  AND (s.archived = FALSE OR s.archived IS NULL)
              )::int AS total_estudiantes
         FROM programas p
         ${whereClause}
         ORDER BY p.nombre ASC;`,
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
    intensidad_horaria,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE programas
       SET
         nombre             = COALESCE($1, nombre),
         tipo_programa      = COALESCE($2, tipo_programa),
         descripcion        = COALESCE($3, descripcion),
         duracion_meses     = COALESCE($4, duracion_meses),
         valor_matricula    = COALESCE($5, valor_matricula),
         valor_mensualidad  = COALESCE($6, valor_mensualidad),
         derechos_grado     = COALESCE($7, derechos_grado),
         activo             = COALESCE($8, activo),
         intensidad_horaria = COALESCE($11, intensidad_horaria),
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
        duracion_meses    !== undefined && duracion_meses    !== null && duracion_meses    !== '' ? Number(duracion_meses)    : null,
        valor_matricula   !== undefined && valor_matricula   !== null && valor_matricula   !== '' ? Number(valor_matricula)   : null,
        valor_mensualidad !== undefined && valor_mensualidad !== null && valor_mensualidad !== '' ? Number(valor_mensualidad) : null,
        derechos_grado    !== undefined && derechos_grado    !== null && derechos_grado    !== '' ? Number(derechos_grado)    : null,
        activo !== undefined ? activo : null,
        id,
        businessId,
        intensidad_horaria !== undefined && intensidad_horaria !== null && intensidad_horaria !== '' ? Number(intensidad_horaria) : null,
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

    // Estudiantes inscritos (excluye archivados: al archivar un estudiante debe
    // desaparecer de la lista del programa, igual que de la lista de activos)
    const { rows: estudiantes } = await pool.query(
      `SELECT s.id, s.nombre, s.apellido, s.email,
              s.telefono_whatsapp, s.telefono_llamadas,
              s.numero_documento, s.estado_matricula,
              ep.fecha_graduacion
       FROM estudiante_programas ep
       JOIN students s ON s.id = ep.estudiante_id
       WHERE ep.programa_id = $1
         AND (s.archived = FALSE OR s.archived IS NULL)
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
// ESTUDIANTES DEL PROGRAMA
// ================================================================

// --- DELETE sacar un estudiante de un programa ---
// Solo elimina la fila de estudiante_programas (lo desvincula del programa).
// NO archiva ni borra al estudiante; sigue existiendo y puede seguir en otros programas.
export const removeEstudianteFromPrograma = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, estudianteId } = req.params;

  if (!businessId) {
    return res.status(400).json({ message: "Token sin business asociado." });
  }

  try {
    // El programa debe pertenecer al negocio del token (estudiante_programas no
    // tiene business_id, así que validamos la propiedad a través de programas).
    const { rows: prog } = await pool.query(
      "SELECT id FROM programas WHERE id = $1 AND business_id = $2",
      [id, businessId]
    );
    if (!prog.length) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }

    const { rowCount } = await pool.query(
      `DELETE FROM estudiante_programas
       WHERE programa_id = $1 AND estudiante_id = $2;`,
      [id, estudianteId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ message: "El estudiante no está inscrito en este programa." });
    }
    return res.sendStatus(204);
  } catch (err) {
    console.error("Error en removeEstudianteFromPrograma:", err);
    return res.status(500).json({ message: "Error al sacar el estudiante del programa." });
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

// ================================================================
// AVANCE POR ESTUDIANTE (clases vistas / pendientes)
// ================================================================

// Subconsulta reutilizable: ids de las clases activas de un programa (vía sus
// temas/módulos, ligados por materia o directamente al programa).
const PROG_CLASES_CTE = `
  SELECT c.id
  FROM clases c
  JOIN modulos m ON m.id = c.modulo_id
  LEFT JOIN materias mat ON mat.id = m.materia_id
  WHERE (m.programa_id = $1 OR mat.programa_id = $1)
    AND c.activa = true AND m.activa = true
`;

// --- GET resumen de avance: por cada estudiante del programa, cuántas clases
//     completó de cuántas (para pintar la barra de progreso en la tabla). ---
export const getProgramaProgreso = async (req, res) => {
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

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM (${PROG_CLASES_CTE}) pc;`, [id]);
    const totalClases = totalRes.rows[0].total;

    const { rows } = await pool.query(
      `WITH prog_clases AS (${PROG_CLASES_CTE})
       SELECT s.id AS estudiante_id, s.nombre, s.apellido,
              CAST(s.numero_documento AS TEXT) AS documento,
              COUNT(ec.clase_id) FILTER (WHERE ec.estado = 'completado')::int AS completadas,
              MAX(ec.fecha_completado) AS ultima_actividad
       FROM estudiante_programas ep
       JOIN students s ON s.id = ep.estudiante_id
       LEFT JOIN estudiante_clases ec
         ON ec.estudiante_id = s.id AND ec.clase_id IN (SELECT id FROM prog_clases)
       WHERE ep.programa_id = $1
       GROUP BY s.id, s.nombre, s.apellido, s.numero_documento
       ORDER BY s.nombre, s.apellido;`,
      [id]
    );

    return res.status(200).json({ total_clases: totalClases, estudiantes: rows });
  } catch (err) {
    console.error("Error en getProgramaProgreso:", err);
    return res.status(500).json({ message: "Error al obtener el avance del programa." });
  }
};

// --- GET detalle de avance de UN estudiante: materias → temas → clases con su
//     estado (completado/pendiente) y fecha. ---
export const getEstudianteProgresoPrograma = async (req, res) => {
  const businessId = req.user?.bid;
  const { id, estudianteId } = req.params;

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

    const estRes = await pool.query(
      `SELECT id, nombre, apellido, CAST(numero_documento AS TEXT) AS documento
       FROM students WHERE id = $1;`,
      [estudianteId]
    );
    if (estRes.rows.length === 0) {
      return res.status(404).json({ message: "Estudiante no encontrado." });
    }

    // Todas las clases del programa con el estado del estudiante (o 'pendiente').
    const { rows } = await pool.query(
      `SELECT mat.id AS materia_id, mat.nombre AS materia_nombre,
              m.id AS modulo_id, m.titulo AS modulo_titulo, m.orden AS modulo_orden,
              c.id AS clase_id, c.titulo AS clase_titulo, c.orden AS clase_orden,
              COALESCE(ec.estado, 'pendiente') AS estado, ec.fecha_completado
       FROM clases c
       JOIN modulos m ON m.id = c.modulo_id
       LEFT JOIN materias mat ON mat.id = m.materia_id
       LEFT JOIN estudiante_clases ec ON ec.clase_id = c.id AND ec.estudiante_id = $2
       WHERE (m.programa_id = $1 OR mat.programa_id = $1)
         AND c.activa = true AND m.activa = true
       ORDER BY mat.nombre NULLS FIRST, m.orden ASC, m.created_at ASC, c.orden ASC, c.created_at ASC;`,
      [id, estudianteId]
    );

    // Agrupar plano → materias[] → temas[] → clases[].
    const materiasMap = new Map();
    let totalClases = 0;
    let completadas = 0;
    for (const r of rows) {
      totalClases += 1;
      if (r.estado === 'completado') completadas += 1;

      const matKey = r.materia_id ?? 'sin_materia';
      if (!materiasMap.has(matKey)) {
        materiasMap.set(matKey, {
          id: r.materia_id, nombre: r.materia_nombre || 'Sin materia', temas: new Map(),
        });
      }
      const materia = materiasMap.get(matKey);
      if (!materia.temas.has(r.modulo_id)) {
        materia.temas.set(r.modulo_id, {
          id: r.modulo_id, titulo: r.modulo_titulo, orden: r.modulo_orden, clases: [],
        });
      }
      materia.temas.get(r.modulo_id).clases.push({
        id: r.clase_id, titulo: r.clase_titulo, orden: r.clase_orden,
        estado: r.estado, fecha_completado: r.fecha_completado,
      });
    }

    const materias = [...materiasMap.values()].map((mat) => ({
      id: mat.id, nombre: mat.nombre, temas: [...mat.temas.values()],
    }));

    return res.status(200).json({
      estudiante: estRes.rows[0],
      total_clases: totalClases,
      completadas,
      materias,
    });
  } catch (err) {
    console.error("Error en getEstudianteProgresoPrograma:", err);
    return res.status(500).json({ message: "Error al obtener el detalle de avance del estudiante." });
  }
};
