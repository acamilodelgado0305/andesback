// src/controllers/programasController.js
import pool from "../database.js";

/**
 * CREAR PROGRAMA
 * Incluye cálculo automático de monto_total si no se provee.
 */
export const createPrograma = async (req, res) => {
  const {
    nombre,
    tipo_programa,
    descripcion,
    duracion_meses,
    valor_matricula,
    valor_mensualidad,
    derechos_grado // <--- Nuevo campo
  } = req.body;

  if (!nombre || !tipo_programa) {
    return res.status(400).json({
      message: "Los campos 'nombre' y 'tipo_programa' son obligatorios.",
    });
  }

  try {
    // 1. Convertir a números seguros (defaults a 0 si no vienen)
    const duracion = Number(duracion_meses) || 0;
    const mensualidad = Number(valor_mensualidad) || 0;
    const matricula = Number(valor_matricula) || 0;
    const grado = Number(derechos_grado) || 0;

    // 2. Calcular Monto Total Automáticamente
    const monto_total = (duracion * mensualidad) + matricula + grado;

    const query = `
      INSERT INTO public.programas (
        nombre, 
        tipo_programa, 
        descripcion, 
        duracion_meses, 
        valor_matricula, 
        valor_mensualidad, 
        derechos_grado,
        monto_total, 
        activo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *;
    `;

    const values = [
      nombre.trim(),
      tipo_programa.trim(),
      descripcion ? descripcion.trim() : null,
      duracion,
      matricula,
      mensualidad,
      grado,
      monto_total
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({
      message: "Programa creado correctamente.",
      data: rows[0],
    });

  } catch (err) {
    console.error("Error en createPrograma:", err);
    if (err.code === '23505') {
      return res.status(409).json({ message: "Ya existe un programa con ese nombre." });
    }
    return res.status(500).json({ message: "Error interno al crear el programa." });
  }
};

/**
 * LISTAR PROGRAMAS
 * Filtros dinámicos por tipo y estado.
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

    const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    const query = `
      SELECT * FROM public.programas
      ${whereClause}
      ORDER BY nombre ASC;
    `;

    const { rows } = await pool.query(query, valores);
    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error en getProgramas:", err);
    return res.status(500).json({ message: "Error al obtener programas." });
  }
};

/**
 * OBTENER POR ID
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
    return res.status(500).json({ message: "Error al obtener el programa." });
  }
};

/**
 * ACTUALIZAR PROGRAMA
 * Usa COALESCE para permitir actualizaciones parciales (PATCH).
 */
export const updatePrograma = async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    tipo_programa,
    descripcion,
    duracion_meses,
    valor_matricula,
    valor_mensualidad,
    derechos_grado,
    activo
  } = req.body;

  try {
    // Explicación de la Query SQL Avanzada:
    // 1. Actualizamos los campos individuales con COALESCE (si es null, deja el viejo).
    // 2. Para 'monto_total', usamos una fórmula con los valores NUEVOS (si existen) o los VIEJOS (si no).
    //    Esto garantiza que el total siempre sea consistente.

    const query = `
      UPDATE public.programas
      SET
        nombre            = COALESCE($1, nombre),
        tipo_programa     = COALESCE($2, tipo_programa),
        descripcion       = COALESCE($3, descripcion),
        duracion_meses    = COALESCE($4, duracion_meses),
        valor_matricula   = COALESCE($5, valor_matricula),
        valor_mensualidad = COALESCE($6, valor_mensualidad),
        derechos_grado    = COALESCE($7, derechos_grado),
        activo            = COALESCE($8, activo),
        
        -- Recálculo automático del total en la misma consulta
        monto_total = (
            (COALESCE($4, duracion_meses) * COALESCE($6, valor_mensualidad)) + 
            COALESCE($5, valor_matricula) + 
            COALESCE($7, derechos_grado)
        )
      WHERE id = $9
      RETURNING *;
    `;

    const values = [
      nombre ? nombre.trim() : null,
      tipo_programa ? tipo_programa.trim() : null,
      descripcion ? descripcion.trim() : null,
      duracion_meses || null,     // $4
      valor_matricula || null,    // $5
      valor_mensualidad || null,  // $6
      derechos_grado || null,     // $7
      activo !== undefined ? activo : null,
      id                          // $9
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
      return res.status(409).json({ message: "Ya existe otro programa con ese nombre." });
    }
    return res.status(500).json({ message: "Error al actualizar el programa." });
  }
};

/**
 * ELIMINAR (DESACTIVAR) PROGRAMA
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
    return res.status(500).json({ message: "Error al desactivar el programa." });
  }
};