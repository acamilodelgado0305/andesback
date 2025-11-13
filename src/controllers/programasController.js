// src/controllers/programasController.js
import pool from "../database.js";

/**
 * Crear programa
 * Body:
 *  - nombre (string)
 *  - tipo_programa ('Validacion', 'Tecnico', etc.)
 *  - descripcion? (string)
 *  - duracion_meses? (int)
 */
export const createPrograma = async (req, res) => {
  const { nombre, tipo_programa, descripcion, duracion_meses } = req.body;

  if (!nombre || !tipo_programa) {
    return res.status(400).json({
      message: "Los campos nombre y tipo_programa son obligatorios.",
    });
  }

  try {
    const query = `
      INSERT INTO public.programas (
        nombre, tipo_programa, descripcion, duracion_meses, activo
      )
      VALUES ($1,$2,$3,$4,true)
      RETURNING *;
    `;
    const values = [
      nombre,
      tipo_programa,
      descripcion || null,
      duracion_meses || null,
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      message: "Programa creado correctamente.",
      data: rows[0],
    });
  } catch (err) {
    console.error("Error en createPrograma:", err);
    return res.status(500).json({
      message: "Error al crear el programa.",
      error: err.message,
    });
  }
};

/**
 * Listar programas
 * Query params opcionales:
 *  - tipo_programa (string)
 *  - activo (true/false)
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

    const query = `
      SELECT *
      FROM public.programas
      ${whereClause}
      ORDER BY nombre ASC;
    `;

    const { rows } = await pool.query(query, valores);

    // 👀 IMPORTANTE: devolvemos directamente el array,
    // como haces en inventario, para que el front lo use fácil.
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
 * Params: :id
 */
export const getProgramaById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT *
      FROM public.programas
      WHERE id = $1;
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Programa no encontrado.",
      });
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
 * Params: :id
 * Body: { nombre?, tipo_programa?, descripcion?, duracion_meses?, activo? }
 */
export const updatePrograma = async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo_programa, descripcion, duracion_meses, activo } =
    req.body;

  try {
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
      nombre || null,
      tipo_programa || null,
      descripcion || null,
      duracion_meses || null,
      activo,
      id,
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Programa no encontrado.",
      });
    }

    return res.status(200).json({
      message: "Programa actualizado correctamente.",
      data: rows[0],
    });
  } catch (err) {
    console.error("Error en updatePrograma:", err);
    return res.status(500).json({
      message: "Error al actualizar el programa.",
      error: err.message,
    });
  }
};

/**
 * "Eliminar" programa
 * ⚠️ Recomendado: borrado lógico (activo = false)
 * para no romper FKs con students/evaluaciones.
 */
export const deletePrograma = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      UPDATE public.programas
      SET activo = false
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Programa no encontrado.",
      });
    }

    return res.status(200).json({
      message: "Programa desactivado correctamente.",
    });
  } catch (err) {
    console.error("Error en deletePrograma:", err);
    return res.status(500).json({
      message: "Error al desactivar el programa.",
      error: err.message,
    });
  }
};
