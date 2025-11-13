// src/controllers/evaluacionesController.js
import pool from '../database.js';

/**
 * Crear una nueva evaluación
 * Body:
 *  - titulo, descripcion, tipo_destino, programa_id, materia_id,
 *    fecha_inicio, fecha_fin, intentos_max, tiempo_limite_min, activa
 */
export const createEvaluacion = async (req, res) => {
  const {
    titulo,
    descripcion,
    tipo_destino,
    programa_id,
    materia_id,          // <<< NUEVO
    fecha_inicio,
    fecha_fin,
    intentos_max,
    tiempo_limite_min,
    activa = true,
  } = req.body;

  try {
    const query = `
      INSERT INTO public.evaluaciones (
        titulo, descripcion, tipo_destino, programa_id, materia_id,
        fecha_inicio, fecha_fin, intentos_max, tiempo_limite_min, activa
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;
    const values = [
      titulo,
      descripcion || null,
      tipo_destino || null,
      programa_id || null,
      materia_id || null,           // <<< NUEVO
      fecha_inicio || null,
      fecha_fin || null,
      intentos_max || null,
      tiempo_limite_min || null,
      activa,
    ];

    const { rows } = await pool.query(query, values);
    return res.status(201).json({
      ok: true,
      message: 'Evaluación creada correctamente',
      evaluacion: rows[0],
    });
  } catch (error) {
    console.error('Error en createEvaluacion:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear la evaluación',
      error: error.message,
    });
  }
};

/**
 * Listar evaluaciones (filtros opcionales: programa_id, tipo_destino, activa)
 * Query params: ?programa_id=...&tipo_destino=...&activa=true
 */
export const getEvaluaciones = async (req, res) => {
  const { programa_id, tipo_destino, activa } = req.query;

  try {
    const condiciones = [];
    const valores = [];
    let idx = 1;

    if (programa_id) {
      condiciones.push(`programa_id = $${idx++}`);
      valores.push(programa_id);
    }
    if (tipo_destino) {
      condiciones.push(`tipo_destino = $${idx++}`);
      valores.push(tipo_destino);
    }
    if (activa !== undefined) {
      condiciones.push(`activa = $${idx++}`);
      valores.push(activa === 'true');
    }

    const whereClause =
      condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const query = `
      SELECT *
      FROM public.evaluaciones
      ${whereClause}
      ORDER BY id DESC;
    `;

    const { rows } = await pool.query(query, valores);

    return res.json({
      ok: true,
      evaluaciones: rows,
    });
  } catch (error) {
    console.error('Error en getEvaluaciones:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener evaluaciones',
      error: error.message,
    });
  }
};

/**
 * Obtener una evaluación con sus preguntas y opciones (modo admin)
 * Params: :id (evaluacion_id)
 */
export const getEvaluacionById = async (req, res) => {
  const { id } = req.params;

  try {
    const evaluacionQuery = 'SELECT * FROM public.evaluaciones WHERE id = $1;';
    const evaluacionResult = await pool.query(evaluacionQuery, [id]);

    if (evaluacionResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Evaluación no encontrada',
      });
    }

    const preguntasQuery = `
      SELECT p.id, p.enunciado, p.tipo_pregunta, p.es_obligatoria, p.puntaje, p.orden,
             o.id AS opcion_id, o.texto AS opcion_texto, o.es_correcta, o.orden AS opcion_orden
      FROM public.evaluacion_preguntas p
      LEFT JOIN public.evaluacion_opciones o
        ON o.pregunta_id = p.id
      WHERE p.evaluacion_id = $1
      ORDER BY p.orden, o.orden;
    `;
    const preguntasResult = await pool.query(preguntasQuery, [id]);

    const preguntasMap = new Map();

    preguntasResult.rows.forEach((row) => {
      if (!preguntasMap.has(row.id)) {
        preguntasMap.set(row.id, {
          id: row.id,
          enunciado: row.enunciado,
          tipo_pregunta: row.tipo_pregunta,
          es_obligatoria: row.es_obligatoria,
          puntaje: row.puntaje,
          orden: row.orden,
          opciones: [],
        });
      }

      if (row.opcion_id) {
        preguntasMap.get(row.id).opciones.push({
          id: row.opcion_id,
          texto: row.opcion_texto,
          es_correcta: row.es_correcta,
          orden: row.opcion_orden,
        });
      }
    });

    const preguntas = Array.from(preguntasMap.values());

    return res.json({
      ok: true,
      evaluacion: evaluacionResult.rows[0],
      preguntas,
    });
  } catch (error) {
    console.error('Error en getEvaluacionById:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener la evaluación',
      error: error.message,
    });
  }
};

/**
 * Actualizar datos generales de una evaluación
 * Params: :id
 * Body: mismos campos que createEvaluacion (opcionales)
 */
export const updateEvaluacion = async (req, res) => {
  const { id } = req.params;
  const {
    titulo,
    descripcion,
    tipo_pregunta,
    tipo_destino,
    programa_id,
    materia_id,        // <<< NUEVO
    fecha_inicio,
    fecha_fin,
    intentos_max,
    tiempo_limite_min,
    activa,
  } = req.body;

  try {
    const query = `
      UPDATE public.evaluaciones
      SET
        titulo = COALESCE($1, titulo),
        descripcion = COALESCE($2, descripcion),
        tipo_destino = COALESCE($3, tipo_destino),
        programa_id = COALESCE($4, programa_id),
        materia_id = COALESCE($5, materia_id),
        fecha_inicio = COALESCE($6, fecha_inicio),
        fecha_fin = COALESCE($7, fecha_fin),
        intentos_max = COALESCE($8, intentos_max),
        tiempo_limite_min = COALESCE($9, tiempo_limite_min),
        activa = COALESCE($10, activa)
      WHERE id = $11
      RETURNING *;
    `;
    const values = [
      titulo || null,
      descripcion || null,
      tipo_destino || null,
      programa_id || null,
      materia_id || null,     // <<< NUEVO
      fecha_inicio || null,
      fecha_fin || null,
      intentos_max || null,
      tiempo_limite_min || null,
      activa,
      id,
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Evaluación no encontrada',
      });
    }

    return res.json({
      ok: true,
      message: 'Evaluación actualizada correctamente',
      evaluacion: rows[0],
    });
  } catch (error) {
    console.error('Error en updateEvaluacion:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar la evaluación',
      error: error.message,
    });
  }
};

/**
 * Eliminar evaluación
 */
export const deleteEvaluacion = async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'DELETE FROM public.evaluaciones WHERE id = $1 RETURNING id;';
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Evaluación no encontrada',
      });
    }

    return res.json({
      ok: true,
      message: 'Evaluación eliminada correctamente',
    });
  } catch (error) {
    console.error('Error en deleteEvaluacion:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar la evaluación',
      error: error.message,
    });
  }
};

/* ===================== PREGUNTAS Y OPCIONES ===================== */

export const addPreguntaConOpciones = async (req, res) => {
  const { id: evaluacion_id } = req.params;
  const {
    enunciado,
    tipo_pregunta,
    es_obligatoria = true,
    puntaje = 1,
    orden,
    opciones = [],
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertPreguntaQuery = `
      INSERT INTO public.evaluacion_preguntas (
        evaluacion_id, enunciado, tipo_pregunta, es_obligatoria, puntaje, orden
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *;
    `;
    const preguntaValues = [
      evaluacion_id,
      enunciado,
      tipo_pregunta,
      es_obligatoria,
      puntaje,
      orden || null,
    ];

    const preguntaResult = await client.query(
      insertPreguntaQuery,
      preguntaValues
    );
    const pregunta = preguntaResult.rows[0];

    let opcionesInsertadas = [];

    if (opciones && opciones.length > 0) {
      const insertOpcionQuery = `
        INSERT INTO public.evaluacion_opciones (
          pregunta_id, texto, es_correcta, orden
        )
        VALUES ($1,$2,$3,$4)
        RETURNING *;
      `;

      for (const op of opciones) {
        const opResult = await client.query(insertOpcionQuery, [
          pregunta.id,
          op.texto,
          op.es_correcta || false,
          op.orden || null,
        ]);

        opcionesInsertadas.push(opResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      ok: true,
      message: 'Pregunta creada correctamente',
      pregunta,
      opciones: opcionesInsertadas,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en addPreguntaConOpciones:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear la pregunta',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const updatePregunta = async (req, res) => {
  const { preguntaId } = req.params;
  const { enunciado, tipo_pregunta, es_obligatoria, puntaje, orden } =
    req.body;

  try {
    const query = `
      UPDATE public.evaluacion_preguntas
      SET
        enunciado = COALESCE($1, enunciado),
        tipo_pregunta = COALESCE($2, tipo_pregunta),
        es_obligatoria = COALESCE($3, es_obligatoria),
        puntaje = COALESCE($4, puntaje),
        orden = COALESCE($5, orden)
      WHERE id = $6
      RETURNING *;
    `;
    const values = [
      enunciado || null,
      tipo_pregunta || null,
      es_obligatoria,
      puntaje || null,
      orden || null,
      preguntaId,
    ];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Pregunta no encontrada',
      });
    }

    return res.json({
      ok: true,
      message: 'Pregunta actualizada correctamente',
      pregunta: rows[0],
    });
  } catch (error) {
    console.error('Error en updatePregunta:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar la pregunta',
      error: error.message,
    });
  }
};

export const deletePregunta = async (req, res) => {
  const { preguntaId } = req.params;

  try {
    const query = `
      DELETE FROM public.evaluacion_preguntas
      WHERE id = $1
      RETURNING id;
    `;
    const { rows } = await pool.query(query, [preguntaId]);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Pregunta no encontrada',
      });
    }

    return res.json({
      ok: true,
      message: 'Pregunta eliminada correctamente',
    });
  } catch (error) {
    console.error('Error en deletePregunta:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar la pregunta',
      error: error.message,
    });
  }
};

export const addOpcion = async (req, res) => {
  const { preguntaId } = req.params;
  const { texto, es_correcta = false, orden } = req.body;

  try {
    const query = `
      INSERT INTO public.evaluacion_opciones (
        pregunta_id, texto, es_correcta, orden
      )
      VALUES ($1,$2,$3,$4)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      preguntaId,
      texto,
      es_correcta,
      orden || null,
    ]);

    return res.status(201).json({
      ok: true,
      message: 'Opción creada correctamente',
      opcion: rows[0],
    });
  } catch (error) {
    console.error('Error en addOpcion:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al crear la opción',
      error: error.message,
    });
  }
};

export const updateOpcion = async (req, res) => {
  const { opcionId } = req.params;
  const { texto, es_correcta, orden } = req.body;

  try {
    const query = `
      UPDATE public.evaluacion_opciones
      SET
        texto = COALESCE($1, texto),
        es_correcta = COALESCE($2, es_correcta),
        orden = COALESCE($3, orden)
      WHERE id = $4
      RETURNING *;
    `;
    const values = [texto || null, es_correcta, orden || null, opcionId];

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Opción no encontrada',
      });
    }

    return res.json({
      ok: true,
      message: 'Opción actualizada correctamente',
      opcion: rows[0],
    });
  } catch (error) {
    console.error('Error en updateOpcion:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar la opción',
      error: error.message,
    });
  }
};

export const deleteOpcion = async (req, res) => {
  const { opcionId } = req.params;

  try {
    const query = `
      DELETE FROM public.evaluacion_opciones
      WHERE id = $1
      RETURNING id;
    `;
    const { rows } = await pool.query(query, [opcionId]);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Opción no encontrada',
      });
    }

    return res.json({
      ok: true,
      message: 'Opción eliminada correctamente',
    });
  } catch (error) {
    console.error('Error en deleteOpcion:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar la opción',
      error: error.message,
    });
  }
};
/* ===================== ASIGNACIONES ===================== */

/**
 * Asignar evaluación a estudiantes por programa principal (students.programa_id)
 */
export const asignarPorProgramaPrincipal = async (req, res) => {
  const { id: evaluacion_id } = req.params;
  const { programa_id } = req.body;

  if (!programa_id) {
    return res.status(400).json({
      ok: false,
      message: 'programa_id es requerido',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO public.evaluacion_asignaciones (
        evaluacion_id, estudiante_id, estado, intentos_realizados
      )
      SELECT
        $1 AS evaluacion_id,
        ep.estudiante_id AS estudiante_id,
        'pendiente' AS estado,
        0 AS intentos_realizados
      FROM public.estudiante_programas ep
      JOIN public.students s
        ON s.id = ep.estudiante_id
      WHERE ep.programa_id = $2
        AND NOT EXISTS (
          SELECT 1
          FROM public.evaluacion_asignaciones ea
          WHERE ea.evaluacion_id = $1
            AND ea.estudiante_id = ep.estudiante_id
        );
    `;

    await client.query(insertQuery, [evaluacion_id, programa_id]);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      message: 'Evaluación asignada a estudiantes del programa (usando estudiante_programas)',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en asignarPorProgramaPrincipal:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al asignar evaluación',
      error: error.message,
    });
  } finally {
    client.release();
  }
};


/**
 * Asignar evaluación usando estudiante_programas (muchos a muchos)
 */
export const asignarPorEstudianteProgramas = async (req, res) => {
  const { id: evaluacion_id } = req.params;
  const { programa_id } = req.body;

  if (!programa_id) {
    return res.status(400).json({
      ok: false,
      message: 'programa_id es requerido',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO public.evaluacion_asignaciones (
        evaluacion_id, estudiante_id, estado, intentos_realizados
      )
      SELECT DISTINCT
        $1 AS evaluacion_id,
        ep.estudiante_id,
        'pendiente' AS estado,
        0 AS intentos_realizados
      FROM public.estudiante_programas ep
      WHERE ep.programa_id = $2
        AND NOT EXISTS (
          SELECT 1
          FROM public.evaluacion_asignaciones ea
          WHERE ea.evaluacion_id = $1
            AND ea.estudiante_id = ep.estudiante_id
        );
    `;
    await client.query(insertQuery, [evaluacion_id, programa_id]);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      message:
        'Evaluación asignada a estudiantes a través de estudiante_programas',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en asignarPorEstudianteProgramas:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al asignar evaluación',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

/**
 * 🔹 NUEVO: Asignar evaluación a una lista específica de estudiantes
 * Params: :id (evaluacion_id)
 * Body: { estudiante_ids: [1,2,3,...] }
 */
export const asignarAEstudiantesSeleccionados = async (req, res) => {
  const { id: evaluacion_id } = req.params;
  const { estudiante_ids } = req.body;

  if (!Array.isArray(estudiante_ids) || estudiante_ids.length === 0) {
    return res.status(400).json({
      ok: false,
      message: 'Debe enviar un arreglo estudiante_ids con al menos un id',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertQuery = `
      WITH nuevos AS (
        SELECT UNNEST($2::int[]) AS estudiante_id
      )
      INSERT INTO public.evaluacion_asignaciones (
        evaluacion_id, estudiante_id, estado, intentos_realizados
      )
      SELECT
        $1,
        n.estudiante_id,
        'pendiente',
        0
      FROM nuevos n
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.evaluacion_asignaciones ea
        WHERE ea.evaluacion_id = $1
          AND ea.estudiante_id = n.estudiante_id
      );
    `;

    await client.query(insertQuery, [evaluacion_id, estudiante_ids]);

    await client.query('COMMIT');

    return res.json({
      ok: true,
      message: 'Evaluación asignada a los estudiantes seleccionados',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en asignarAEstudiantesSeleccionados:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al asignar evaluación a estudiantes seleccionados',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

/**
 * Listar evaluaciones asignadas a un estudiante
 */
export const getEvaluacionesDeEstudiante = async (req, res) => {
  const { estudianteId } = req.params;

  try {
    const query = `
      SELECT
        ea.id AS asignacion_id,
        ea.estado,
        ea.intentos_realizados,
        ea.calificacion,
        ea.fecha_resuelto,
        e.id AS evaluacion_id,
        e.titulo,
        e.descripcion,
        e.fecha_inicio,
        e.fecha_fin,
        e.tiempo_limite_min
      FROM public.evaluacion_asignaciones ea
      JOIN public.evaluaciones e
        ON e.id = ea.evaluacion_id
      WHERE ea.estudiante_id = $1
        AND e.activa = TRUE
        AND (e.fecha_inicio IS NULL OR e.fecha_inicio <= NOW())
        AND (e.fecha_fin IS NULL OR e.fecha_fin >= NOW())
      ORDER BY ea.estado, ea.id DESC;
    `;
    const { rows } = await pool.query(query, [estudianteId]);

    return res.json({
      ok: true,
      asignaciones: rows,
    });
  } catch (error) {
    console.error('Error en getEvaluacionesDeEstudiante:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener evaluaciones del estudiante',
      error: error.message,
    });
  }
};

/**
 * Obtener detalle de una asignación para que el estudiante responda
 */
export const getAsignacionDetalleParaResponder = async (req, res) => {
  const { asignacionId } = req.params;

  try {
    const asignacionQuery = `
      SELECT
        ea.*,
        e.titulo,
        e.descripcion,
        e.tiempo_limite_min,
        e.fecha_inicio,
        e.fecha_fin
      FROM public.evaluacion_asignaciones ea
      JOIN public.evaluaciones e
        ON e.id = ea.evaluacion_id
      WHERE ea.id = $1;
    `;
    const asignacionResult = await pool.query(asignacionQuery, [asignacionId]);

    if (asignacionResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Asignación no encontrada',
      });
    }

    const asignacion = asignacionResult.rows[0];

    const preguntasQuery = `
      SELECT
        p.id AS pregunta_id,
        p.enunciado,
        p.tipo_pregunta,
        p.es_obligatoria,
        p.puntaje,
        p.orden,
        o.id AS opcion_id,
        o.texto AS opcion_texto,
        o.orden AS opcion_orden
      FROM public.evaluacion_preguntas p
      LEFT JOIN public.evaluacion_opciones o
        ON o.pregunta_id = p.id
      WHERE p.evaluacion_id = $1
      ORDER BY p.orden, o.orden;
    `;
    const preguntasResult = await pool.query(preguntasQuery, [
      asignacion.evaluacion_id,
    ]);

    const preguntasMap = new Map();

    preguntasResult.rows.forEach((row) => {
      if (!preguntasMap.has(row.pregunta_id)) {
        preguntasMap.set(row.pregunta_id, {
          id: row.pregunta_id,
          enunciado: row.enunciado,
          tipo_pregunta: row.tipo_pregunta,
          es_obligatoria: row.es_obligatoria,
          puntaje: row.puntaje,
          orden: row.orden,
          opciones: [],
        });
      }

      if (row.opcion_id) {
        preguntasMap.get(row.pregunta_id).opciones.push({
          id: row.opcion_id,
          texto: row.opcion_texto,
          orden: row.opcion_orden,
        });
      }
    });

    const preguntas = Array.from(preguntasMap.values());

    return res.json({
      ok: true,
      asignacion: {
        id: asignacion.id,
        estado: asignacion.estado,
        intentos_realizados: asignacion.intentos_realizados,
        calificacion: asignacion.calificacion,
        fecha_resuelto: asignacion.fecha_resuelto,
        evaluacion_id: asignacion.evaluacion_id,
        titulo: asignacion.titulo,
        descripcion: asignacion.descripcion,
        tiempo_limite_min: asignacion.tiempo_limite_min,
        fecha_inicio: asignacion.fecha_inicio,
        fecha_fin: asignacion.fecha_fin,
      },
      preguntas,
    });
  } catch (error) {
    console.error('Error en getAsignacionDetalleParaResponder:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener detalle de la asignación',
      error: error.message,
    });
  }
};

/**
 * Enviar respuestas de una asignación (auto-calificar + actualizar grades)
 * Params: :asignacionId
 * Body:
 *  {
 *    respuestas: [
 *      { pregunta_id, opcion_id?, respuesta_texto? },
 *      ...
 *    ]
 *  }
 */
export const responderEvaluacion = async (req, res) => {
  const { asignacionId } = req.params;
  const { respuestas = [] } = req.body;

  if (!Array.isArray(respuestas) || respuestas.length === 0) {
    return res.status(400).json({
      ok: false,
      message: 'Debe enviar al menos una respuesta',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener asignación + evaluación (para intentos y evaluacion_id)
    const asignacionQuery = `
      SELECT
        ea.*,
        e.intentos_max
      FROM public.evaluacion_asignaciones ea
      JOIN public.evaluaciones e
        ON e.id = ea.evaluacion_id
      WHERE ea.id = $1
      FOR UPDATE;
    `;
    const asignacionResult = await client.query(asignacionQuery, [
      asignacionId,
    ]);

    if (asignacionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        ok: false,
        message: 'Asignación no encontrada',
      });
    }

    const asignacion = asignacionResult.rows[0];

    // Validar intentos
    if (
      asignacion.intentos_max !== null &&
      asignacion.intentos_max > 0 &&
      asignacion.intentos_realizados >= asignacion.intentos_max
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        message: 'Se han agotado los intentos permitidos para esta evaluación',
      });
    }

    // 2. Traer preguntas y opciones (para calificar)
    const preguntasQuery = `
      SELECT
        p.id AS pregunta_id,
        p.tipo_pregunta,
        p.puntaje,
        o.id AS opcion_id,
        o.es_correcta
      FROM public.evaluacion_preguntas p
      LEFT JOIN public.evaluacion_opciones o
        ON o.pregunta_id = p.id
      WHERE p.evaluacion_id = $1;
    `;
    const preguntasResult = await client.query(preguntasQuery, [
      asignacion.evaluacion_id,
    ]);

    const preguntasMap = new Map();
    preguntasResult.rows.forEach((row) => {
      if (!preguntasMap.has(row.pregunta_id)) {
        preguntasMap.set(row.pregunta_id, {
          tipo_pregunta: row.tipo_pregunta,
          puntaje: Number(row.puntaje || 0),
          opciones: new Map(),
        });
      }
      if (row.opcion_id) {
        preguntasMap
          .get(row.pregunta_id)
          .opciones.set(row.opcion_id, row.es_correcta);
      }
    });

    // Calcular puntaje máximo para preguntas auto-calificables
    let puntajeMaximo = 0;
    preguntasMap.forEach((info) => {
      if (
        info.tipo_pregunta === 'opcion_multiple' ||
        info.tipo_pregunta === 'verdadero_falso'
      ) {
        puntajeMaximo += Number(info.puntaje || 0);
      }
    });

    // 3. Borrar respuestas anteriores (si existe reintento)
    await client.query(
      'DELETE FROM public.evaluacion_respuestas WHERE asignacion_id = $1;',
      [asignacionId]
    );

    // 4. Insertar nuevas respuestas y calcular nota bruta
    let calificacionBruta = 0;

    const insertRespuestaQuery = `
      INSERT INTO public.evaluacion_respuestas (
        asignacion_id, pregunta_id, opcion_id, respuesta_texto, es_correcta, puntaje_obtenido
      )
      VALUES ($1,$2,$3,$4,$5,$6);
    `;

    for (const r of respuestas) {
      const { pregunta_id, opcion_id, respuesta_texto } = r;

      if (!pregunta_id) continue;

      const infoPregunta = preguntasMap.get(pregunta_id);
      if (!infoPregunta) continue;

      let es_correcta = null;
      let puntaje_obtenido = 0;

      if (
        infoPregunta.tipo_pregunta === 'opcion_multiple' ||
        infoPregunta.tipo_pregunta === 'verdadero_falso'
      ) {
        const esCorrectaReal = infoPregunta.opciones.get(opcion_id) === true;
        es_correcta = esCorrectaReal;
        puntaje_obtenido = esCorrectaReal ? infoPregunta.puntaje : 0;
      } else if (infoPregunta.tipo_pregunta === 'abierta') {
        // Se puede calificar manual después
        es_correcta = null;
        puntaje_obtenido = 0;
      }

      calificacionBruta += Number(puntaje_obtenido || 0);

      await client.query(insertRespuestaQuery, [
        asignacionId,
        pregunta_id,
        opcion_id || null,
        respuesta_texto || null,
        es_correcta,
        puntaje_obtenido,
      ]);
    }

    // 4.1 Convertir a nota en escala 0–5
    let notaEscala5 = 0;
    if (puntajeMaximo > 0) {
      notaEscala5 = (calificacionBruta / puntajeMaximo) * 5;
    }
    notaEscala5 = Number(notaEscala5.toFixed(2));

    // 5. Actualizar asignación
    const updateAsignacionQuery = `
      UPDATE public.evaluacion_asignaciones
      SET
        estado = 'finalizada',
        intentos_realizados = intentos_realizados + 1,
        calificacion = $1,
        fecha_resuelto = NOW()
      WHERE id = $2;
    `;
    await client.query(updateAsignacionQuery, [notaEscala5, asignacionId]);

    // 6. Actualizar/crear registro en grades para este estudiante + materia
    //    Usamos evaluaciones.materia_id -> materias.nombre & tipo_programa
    const evalMateriaQuery = `
      SELECT
        e.materia_id,
        m.nombre AS materia_nombre,
        m.tipo_programa
      FROM public.evaluaciones e
      LEFT JOIN public.materias m
        ON m.id = e.materia_id
      WHERE e.id = $1;
    `;
    const evalMateriaResult = await client.query(evalMateriaQuery, [
      asignacion.evaluacion_id,
    ]);

    if (
      evalMateriaResult.rows.length > 0 &&
      evalMateriaResult.rows[0].materia_id &&
      evalMateriaResult.rows[0].materia_nombre &&
      evalMateriaResult.rows[0].tipo_programa
    ) {
      const { materia_nombre, tipo_programa } = evalMateriaResult.rows[0];

      const upsertGradeQuery = `
        INSERT INTO public.grades (student_id, materia, programa, nota, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (student_id, programa, materia)
        DO UPDATE SET
          nota = EXCLUDED.nota,
          updated_at = NOW();
      `;

      await client.query(upsertGradeQuery, [
        asignacion.estudiante_id,
        materia_nombre,
        tipo_programa,
        notaEscala5,
      ]);
    }

    await client.query('COMMIT');

    return res.json({
      ok: true,
      message: 'Evaluación enviada y calificada correctamente',
      calificacion: notaEscala5,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en responderEvaluacion:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error al enviar respuestas de la evaluación',
      error: error.message,
    });
  } finally {
    client.release();
  }
};
