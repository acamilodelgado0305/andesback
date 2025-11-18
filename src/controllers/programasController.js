// src/controllers/programasController.js
import pool from "../database.js";

/**
 * Crear programa
 * Mejora: Sanitización de strings y manejo de duplicados.
 */
export const createPrograma = async (req, res) => {
  const { nombre, tipo_programa, descripcion, duracion_meses } = req.body;

  // 1. Validación básica
  if (!nombre || !tipo_programa) {
    return res.status(400).json({
      message: "Los campos 'nombre' y 'tipo_programa' son obligatorios.",
    });
  }

  try {
    const query = `
      INSERT INTO public.programas (
        nombre, tipo_programa, descripcion, duracion_meses, activo
      )
      VALUES ($1, $2, $3, $4, true)
      RETURNING *;
    `;

    // 2. Sanitización (Trim) para evitar espacios basura
    const values = [
      nombre.trim(),
      tipo_programa.trim(),
      descripcion ? descripcion.trim() : null,
      duracion_meses || null,
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      message: "Programa creado correctamente.",
      data: rows[0],
    });

  } catch (err) {
    console.error("Error en createPrograma:", err);

    // 3. Manejo específico de duplicados (Código Postgres 23505)
    if (err.code === '23505') {
      return res.status(409).json({
        message: "Ya existe un programa con ese nombre.",
      });
    }

    return res.status(500).json({
      message: "Error interno al crear el programa.",
      error: err.message,
    });
  }
};

/**
 * Listar programas
 * Mejora: Mantiene tu lógica dinámica que es correcta.
 */
export const getProgramas = async (req, res) => {
  const { tipo_programa, activo } = req.query;

  try {
    const condiciones = [];
    const valores = [];
    let idx = 1;

    if (tipo_programa) {
      condiciones.push(`tipo_programa = $${idx++}`);
      valores.push(tipo_programa);
    }

    if (activo !== undefined) {
      condiciones.push(`activo = $${idx++}`);
      valores.push(activo === "true");
    }

    const whereClause =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    // Ordenamos por nombre para consistencia en el Frontend
    const query = `
      SELECT *
      FROM public.programas
      ${whereClause}
      ORDER BY nombre ASC;
    `;

    const { rows } = await pool.query(query, valores);
    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error en getProgramas:", err);
    return res.status(500).json({
      message: "Error al obtener programas.",
      error: err.message,
    });
  }
};

/**
 * Obtener un programa por ID
 */
export const getProgramaById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = "SELECT * FROM public.programas WHERE id = $1";
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }

    return res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error en getProgramaById:", err);
    return res.status(500).json({
      message: "Error al obtener el programa.",
      error: err.message,
    });
  }
};

/**
 * Actualizar programa
 * Mejora: Uso de COALESCE para permitir actualizaciones parciales (PATCH logic).
 */
export const updatePrograma = async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_programa, descripcion, duracion_meses, activo } = req.body;

  try {
    // COALESCE($1, nombre): Si $1 es NULL, mantiene el valor original de la columna 'nombre'
    // Importante: Si envías undefined desde el front, aquí llega como null/undefined
    // y COALESCE lo ignora. Perfecto para un PATCH.
    const query = `
      UPDATE public.programas
      SET
        nombre         = COALESCE($1, nombre),
        tipo_programa  = COALESCE($2, tipo_programa),
        descripcion    = COALESCE($3, descripcion),
        duracion_meses = COALESCE($4, duracion_meses),
        activo         = COALESCE($5, activo)
      WHERE id = $6
      RETURNING *;
    `;

    const values = [
      nombre ? nombre.trim() : null,
      tipo_programa ? tipo_programa.trim() : null,
      descripcion ? descripcion.trim() : null,
      duracion_meses || null,
      activo !== undefined ? activo : null, // Si es undefined, pasamos null para que COALESCE use el valor viejo
      id,
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }

    return res.status(200).json({
      message: "Programa actualizado correctamente.",
      data: rows[0],
    });
  } catch (err) {
    console.error("Error en updatePrograma:", err);
    
    if (err.code === '23505') {
      return res.status(409).json({
        message: "No se puede actualizar: Ya existe otro programa con ese nombre.",
      });
    }

    return res.status(500).json({
      message: "Error al actualizar el programa.",
      error: err.message,
    });
  }
};

/**
 * Desactivar programa (Soft Delete)
 */
export const deletePrograma = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      UPDATE public.programas
      SET activo = false
      WHERE id = $1
      RETURNING id, nombre, activo;
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Programa no encontrado." });
    }

    return res.status(200).json({
      message: "Programa desactivado correctamente.",
      data: rows[0]
    });
  } catch (err) {
    console.error("Error en deletePrograma:", err);
    return res.status(500).json({
      message: "Error al desactivar el programa.",
      error: err.message,
    });
  }
};