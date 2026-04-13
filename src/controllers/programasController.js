// src/controllers/programasController.js
import pool from "../database.js";

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
