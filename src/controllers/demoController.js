// src/controllers/demoController.js
//
// Siembra y purga el contenido académico de un negocio demo.
//
// Quién llama aquí: SOLO auth-service, que es quien crea el negocio demo y
// conoce el secreto compartido. No hay JWT de usuario en juego porque cuando
// esto corre el visitante todavía no tiene sesión.
//
// El catálogo de ejemplo (programas, materias, clases, estudiantes) vive en
// ../data/demoSeedData.js. Aquí solo está la lógica de inserción.
//
// RENDIMIENTO — leer antes de tocar el seeder:
// El visitante está mirando una pantalla de carga mientras esto corre, así que
// el tiempo total es funcionalidad, no un detalle. La base está en Neon con
// ~120 ms de ida y vuelta: una consulta por fila (340 filas) tardaba 48 s.
// Por eso TODO se inserta por lotes — una sola sentencia multi-fila por tabla,
// unas 23 consultas en total. Si agregas contenido nuevo, agrégalo al lote que
// corresponda; nunca metas un INSERT dentro de un bucle.

import pool from '../database.js';
import { DEMO_DOCENTES, DEMO_PROGRAMAS, DEMO_ESTUDIANTES, DEMO_FORO } from '../data/demoSeedData.js';

const DEMO_SEED_SECRET = process.env.DEMO_SEED_SECRET || '';

/**
 * Middleware: solo pasa quien traiga el secreto compartido entre servicios.
 * Si el secreto no está configurado, el endpoint queda cerrado (no abierto).
 */
export const requireInternalSecret = (req, res, next) => {
  if (!DEMO_SEED_SECRET) {
    console.error('[DEMO] DEMO_SEED_SECRET no configurado en andesback — endpoint deshabilitado.');
    return res.status(503).json({ error: 'Servicio de demo no disponible.' });
  }
  if (req.headers['x-internal-secret'] !== DEMO_SEED_SECRET) {
    return res.status(403).json({ error: 'No autorizado.' });
  }
  next();
};

/**
 * INSERT multi-fila en una sola ida y vuelta.
 *
 * @param {object} client    conexión dentro de la transacción
 * @param {string} tabla
 * @param {string[]} columnas
 * @param {Array[]} filas    una tupla de valores por fila, en el orden de `columnas`
 * @param {string} extra     cola opcional: RETURNING …, ON CONFLICT …
 * @returns {Promise<object[]>} filas devueltas por RETURNING (vacío si no hay)
 *
 * OJO: el orden de RETURNING no está garantizado por el estándar. Por eso
 * siempre devolvemos también una columna que identifique la fila (email,
 * nombre, orden…) y armamos el mapa con ella, nunca por índice.
 */
const insertarLote = async (client, tabla, columnas, filas, extra = '') => {
  if (!filas.length) return [];
  const params = [];
  const tuplas = filas.map((fila) => {
    const marcadores = fila.map((valor) => {
      params.push(valor);
      return `$${params.length}`;
    });
    return `(${marcadores.join(',')})`;
  });
  const sql = `INSERT INTO ${tabla} (${columnas.join(',')}) VALUES ${tuplas.join(',')} ${extra}`;
  const { rows } = await client.query(sql, params);
  return rows;
};

// Nota determinista pero variada, para que el cuadro de calificaciones no se
// vea como una columna del mismo número. Rango 3.0–4.9.
const notaDemo = (i, j) => Number((3.0 + (((i * 7 + j * 13) % 20) / 10)).toFixed(1));

const emailDemo = (nombre, apellido, idx) => {
  const limpia = (s) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  return `${limpia(nombre.split(' ')[0])}.${limpia(apellido.split(' ')[0])}${idx}@correo-demo.co`;
};

const fechaNacimientoDemo = (idx) => {
  // Entre 18 y 42 años, repartidos.
  const anio = 1984 + ((idx * 5) % 25);
  const mes = String(1 + (idx % 12)).padStart(2, '0');
  const dia = String(1 + ((idx * 3) % 27)).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

// ==========================================
// 🌱 POST /api/demo/seed
// ==========================================
export const seedDemoBusiness = async (req, res) => {
  const businessId = parseInt(req.body?.business_id, 10);
  const coordinadorId = parseInt(req.body?.coordinador_id, 10);

  if (!businessId || !coordinadorId) {
    return res.status(400).json({ error: 'business_id y coordinador_id son obligatorios.' });
  }

  // Idempotencia: si el negocio ya tiene programas, no duplicamos nada.
  const yaSembrado = await pool.query('SELECT 1 FROM programas WHERE business_id = $1 LIMIT 1', [businessId]);
  if (yaSembrado.rows.length > 0) {
    return res.status(200).json({ ok: true, message: 'El negocio demo ya estaba sembrado.', skipped: true });
  }

  const inicio = Date.now();
  const client = await pool.connect();
  const resumen = { programas: 0, materias: 0, temas: 0, clases: 0, evaluaciones: 0, estudiantes: 0, notas: 0 };

  try {
    await client.query('BEGIN');

    // ── 1. Docentes ────────────────────────────────────────────────────────
    const filasDocentes = await insertarLote(
      client, 'docentes',
      ['nombre_completo', 'email', 'especialidad', 'business_id'],
      DEMO_DOCENTES.map((d) => [d.nombre_completo, d.email, d.especialidad, businessId]),
      'RETURNING id, email'
    );
    const docenteIdPorEmail = new Map(filasDocentes.map((r) => [r.email, r.id]));
    const docenteId = (key) => {
      const d = DEMO_DOCENTES.find((x) => x.key === key);
      return d ? docenteIdPorEmail.get(d.email) ?? null : null;
    };

    // ── 2. Programas ───────────────────────────────────────────────────────
    const filasProgramas = await insertarLote(
      client, 'programas',
      ['nombre', 'tipo_programa', 'descripcion', 'duracion_meses', 'valor_matricula',
       'valor_mensualidad', 'derechos_grado', 'intensidad_horaria', 'monto_total', 'activo', 'business_id'],
      DEMO_PROGRAMAS.map((p) => [
        p.nombre, p.tipo_programa, p.descripcion, p.duracion_meses, p.valor_matricula,
        p.valor_mensualidad, p.derechos_grado, p.intensidad_horaria,
        p.duracion_meses * p.valor_mensualidad + p.valor_matricula + p.derechos_grado,
        true, businessId,
      ]),
      'RETURNING id, nombre'
    );
    const programaIdPorNombre = new Map(filasProgramas.map((r) => [r.nombre, r.id]));
    const programaId = (key) => programaIdPorNombre.get(DEMO_PROGRAMAS.find((p) => p.key === key).nombre);
    resumen.programas = filasProgramas.length;

    // ── 3. Cierres (periodos) ──────────────────────────────────────────────
    const filasCierres = await insertarLote(
      client, 'cierres',
      ['nombre', 'programa_id', 'business_id', 'orden'],
      DEMO_PROGRAMAS.flatMap((p) =>
        p.cierres.map((nombre, i) => [nombre, programaId(p.key), businessId, i + 1])
      ),
      'RETURNING id, programa_id, orden'
    );
    // Solo necesitamos el primer corte de cada programa (ahí van las notas).
    const primerCierrePorPrograma = new Map(
      filasCierres.filter((r) => r.orden === 1).map((r) => [r.programa_id, r.id])
    );

    // ── 4. Materias ────────────────────────────────────────────────────────
    const materiasPlanas = DEMO_PROGRAMAS.flatMap((p) => p.materias.map((m) => ({ ...m, programaKey: p.key })));
    const filasMaterias = await insertarLote(
      client, 'materias',
      ['nombre', 'programa_id', 'docente_id', 'business_id', 'activa'],
      materiasPlanas.map((m) => [m.nombre, programaId(m.programaKey), docenteId(m.docente), businessId, true]),
      'RETURNING id, nombre, programa_id'
    );
    // (programa_id, nombre) identifica la materia sin ambigüedad: la misma
    // materia puede repetirse en dos programas distintos.
    const materiaIdPor = new Map(filasMaterias.map((r) => [`${r.programa_id}|${r.nombre}`, r.id]));
    const materiaId = (m) => materiaIdPor.get(`${programaId(m.programaKey)}|${m.nombre}`);
    resumen.materias = filasMaterias.length;

    // ── 5. Evaluaciones (una por materia) ──────────────────────────────────
    // tipo_destino se deja NULL: es una columna legacy que la app ya no envía
    // al crear evaluaciones desde la materia.
    const materiasConEval = materiasPlanas.filter((m) => m.evaluacion);
    const filasEvals = await insertarLote(
      client, 'evaluaciones',
      ['titulo', 'descripcion', 'programa_id', 'materia_id', 'intentos_max',
       'tiempo_limite_min', 'activa', 'business_id'],
      materiasConEval.map((m) => [
        m.evaluacion.titulo, m.evaluacion.descripcion, programaId(m.programaKey), materiaId(m),
        2, m.evaluacion.tiempo_limite_min, true, businessId,
      ]),
      'RETURNING id, materia_id'
    );
    const evalIdPorMateria = new Map(filasEvals.map((r) => [r.materia_id, r.id]));
    resumen.evaluaciones = filasEvals.length;

    await insertarLote(
      client, 'evaluacion_programas',
      ['evaluacion_id', 'programa_id'],
      materiasConEval.map((m) => [evalIdPorMateria.get(materiaId(m)), programaId(m.programaKey)]),
      'ON CONFLICT DO NOTHING'
    );

    // ── 6. Preguntas y opciones ────────────────────────────────────────────
    const preguntasPlanas = materiasConEval.flatMap((m) =>
      m.evaluacion.preguntas.map((p, i) => ({ ...p, evaluacionId: evalIdPorMateria.get(materiaId(m)), orden: i + 1 }))
    );
    const filasPreguntas = await insertarLote(
      client, 'evaluacion_preguntas',
      ['evaluacion_id', 'enunciado', 'tipo_pregunta', 'es_obligatoria', 'puntaje', 'orden'],
      preguntasPlanas.map((p) => [p.evaluacionId, p.enunciado, 'opcion_multiple', true, 1, p.orden]),
      'RETURNING id, evaluacion_id, orden'
    );
    const preguntaIdPor = new Map(filasPreguntas.map((r) => [`${r.evaluacion_id}|${r.orden}`, r.id]));

    await insertarLote(
      client, 'evaluacion_opciones',
      ['pregunta_id', 'texto', 'es_correcta', 'orden'],
      preguntasPlanas.flatMap((p) =>
        p.opciones.map(([texto, esCorrecta], i) =>
          [preguntaIdPor.get(`${p.evaluacionId}|${p.orden}`), texto, esCorrecta, i + 1])
      )
    );

    // ── 7. Temas (modulos) y clases ────────────────────────────────────────
    const temasPlanos = materiasPlanas.flatMap((m) =>
      m.temas.map((t, i) => ({ ...t, materiaId: materiaId(m), programaKey: m.programaKey, orden: i }))
    );
    const filasTemas = await insertarLote(
      client, 'modulos',
      ['titulo', 'descripcion', 'activa', 'orden', 'programa_id', 'materia_id', 'business_id'],
      temasPlanos.map((t) => [t.titulo, t.descripcion, true, t.orden, programaId(t.programaKey), t.materiaId, businessId]),
      'RETURNING id, materia_id, orden'
    );
    const temaIdPor = new Map(filasTemas.map((r) => [`${r.materia_id}|${r.orden}`, r.id]));
    resumen.temas = filasTemas.length;

    const clasesPlanas = temasPlanos.flatMap((t) =>
      t.clases.map((c, i) => ({
        ...c,
        temaId: temaIdPor.get(`${t.materiaId}|${t.orden}`),
        programaKey: t.programaKey,
        orden: i,
      }))
    );
    const filasClases = await insertarLote(
      client, 'clases',
      ['modulo_id', 'business_id', 'titulo', 'descripcion', 'orden', 'activa'],
      clasesPlanas.map((c) => [c.temaId, businessId, c.titulo, c.contenido, c.orden, true]),
      'RETURNING id, modulo_id, orden'
    );
    const claseIdPor = new Map(filasClases.map((r) => [`${r.modulo_id}|${r.orden}`, r.id]));
    resumen.clases = filasClases.length;

    // El examen se rinde al terminar el ÚLTIMO tema de la materia.
    const ultimoTemaPorMateria = new Map();
    for (const r of filasTemas) {
      const previo = ultimoTemaPorMateria.get(r.materia_id);
      if (!previo || r.orden > previo.orden) ultimoTemaPorMateria.set(r.materia_id, r);
    }
    await insertarLote(
      client, 'modulo_evaluaciones',
      ['modulo_id', 'evaluacion_id', 'es_requerida'],
      materiasConEval
        .map((m) => {
          const mid = materiaId(m);
          const tema = ultimoTemaPorMateria.get(mid);
          return tema ? [tema.id, evalIdPorMateria.get(mid), true] : null;
        })
        .filter(Boolean),
      'ON CONFLICT (modulo_id, evaluacion_id) DO NOTHING'
    );

    // ── 8. Estudiantes ─────────────────────────────────────────────────────
    // `activo` se deja al DEFAULT de la tabla ('activo'), igual que hace
    // insertStudentToDB: esa columna es texto legacy con valores mezclados
    // ('activo' / 'true') y no conviene inventar uno nuevo aquí.
    const filasStudents = await insertarLote(
      client, 'students',
      ['nombre', 'apellido', 'email', 'tipo_documento', 'numero_documento', 'lugar_expedicion',
       'fecha_nacimiento', 'lugar_nacimiento', 'telefono_llamadas', 'telefono_whatsapp',
       'simat', 'estado_matricula', 'coordinador_id', 'modalidad_estudio',
       'eps', 'rh', 'nombre_acudiente', 'telefono_acudiente', 'business_id'],
      DEMO_ESTUDIANTES.map((e, i) => [
        e.nombre, e.apellido, emailDemo(e.nombre, e.apellido, i), e.tipo_documento,
        e.numero_documento, e.ciudad, fechaNacimientoDemo(i), e.ciudad,
        e.telefono, e.telefono, false, e.matriculado, coordinadorId, 'Clases en Línea',
        e.eps, e.rh, e.acudiente || null, e.acudiente ? e.telefono : null, businessId,
      ]),
      'RETURNING id, numero_documento'
    );
    const studentIdPorDoc = new Map(filasStudents.map((r) => [r.numero_documento, r.id]));
    const estudiantes = DEMO_ESTUDIANTES.map((e, i) => ({
      ...e,
      id: studentIdPorDoc.get(e.numero_documento),
      indice: i,
    })).filter((e) => e.id);
    resumen.estudiantes = estudiantes.length;

    await insertarLote(
      client, 'estudiante_programas',
      ['estudiante_id', 'programa_id'],
      estudiantes.map((e) => [e.id, programaId(e.programa)]),
      'ON CONFLICT DO NOTHING'
    );

    // ── 9. Notas del primer corte ──────────────────────────────────────────
    // Sin notas, el módulo de Calificaciones se ve vacío y no se entiende.
    const materiasPorProgramaKey = new Map(
      DEMO_PROGRAMAS.map((p) => [p.key, p.materias.map((m) => m.nombre)])
    );
    const filasNotas = estudiantes.flatMap((e) => {
      const pid = programaId(e.programa);
      const cierreId = primerCierrePorPrograma.get(pid);
      const programa = DEMO_PROGRAMAS.find((p) => p.key === e.programa);
      if (!cierreId || !programa) return [];
      return (materiasPorProgramaKey.get(e.programa) || []).map((nombreMateria, j) =>
        [e.id, programa.nombre, nombreMateria, notaDemo(e.indice, j), cierreId]
      );
    });
    await insertarLote(
      client, 'grades',
      ['student_id', 'programa', 'materia', 'nota', 'cierre_id'],
      filasNotas,
      'ON CONFLICT (student_id, materia, cierre_id) DO NOTHING'
    );
    resumen.notas = filasNotas.length;

    // ── 10. Progreso de clases ─────────────────────────────────────────────
    // Uno de cada tres estudiantes arranca sin avance; el resto lleva un tramo
    // distinto, para que "Avance del estudiante" y "Mi avance" muestren algo
    // real. Tabla opcional: si la migración no corrió, se omite sin romper.
    const clasesPorPrograma = new Map();
    for (const c of clasesPlanas) {
      const arr = clasesPorPrograma.get(c.programaKey) || [];
      arr.push(claseIdPor.get(`${c.temaId}|${c.orden}`));
      clasesPorPrograma.set(c.programaKey, arr);
    }
    const filasProgreso = estudiantes.flatMap((e) => {
      if (e.indice % 3 === 2) return [];
      const clases = clasesPorPrograma.get(e.programa) || [];
      if (!clases.length) return [];
      const vistas = clases.slice(0, 1 + (e.indice % Math.max(1, clases.length - 1)));
      return vistas.map((claseId) => [claseId, e.id, businessId, 'completado', (e.indice % 10) + 1]);
    });
    try {
      await insertarLote(
        client, 'estudiante_clases',
        ['clase_id', 'estudiante_id', 'business_id', 'estado', 'fecha_completado'],
        filasProgreso.map(([c, s, b, estado, dias]) => [c, s, b, estado, new Date(Date.now() - dias * 864e5)]),
        'ON CONFLICT (clase_id, estudiante_id) DO NOTHING'
      );
    } catch (e) {
      if (e.code !== '42P01') throw e;
      console.warn('[DEMO] estudiante_clases no existe; se omite el progreso de clases.');
    }

    // ── 11. Foro de la primera materia ─────────────────────────────────────
    const primerMateriaId = filasMaterias.length ? materiaId(materiasPlanas[0]) : null;
    try {
      if (primerMateriaId) {
        await insertarLote(
          client, 'materia_foro_posts',
          ['materia_id', 'business_id', 'autor_tipo', 'autor_nombre', 'contenido'],
          DEMO_FORO.map((p) => [primerMateriaId, businessId, p.autor_tipo, p.autor, p.mensaje])
        );
      }
    } catch (e) {
      if (e.code !== '42P01') throw e;
      console.warn('[DEMO] materia_foro_posts no existe; se omite el foro.');
    }

    // ── 12. Pagos de matrícula ─────────────────────────────────────────────
    // tipos_pago es un catálogo global con nombre único. El DO UPDATE (en vez
    // de DO NOTHING) hace que RETURNING traiga el id exista o no la fila, y de
    // paso evita la carrera entre dos demos creándose a la vez.
    try {
      const { rows: tipo } = await client.query(
        `INSERT INTO tipos_pago (nombre) VALUES ('Matrícula')
         ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
         RETURNING id`
      );
      const tipoPagoId = tipo[0]?.id;
      if (tipoPagoId) {
        const periodo = new Date().toISOString().slice(0, 7); // YYYY-MM
        await insertarLote(
          client, 'pagos',
          ['student_id', 'tipo_pago_id', 'monto', 'periodo_pagado', 'metodo_pago',
           'referencia_transaccion', 'estado', 'observaciones', 'created_at'],
          estudiantes
            .filter((e) => e.matriculado)
            .map((e) => {
              const programa = DEMO_PROGRAMAS.find((p) => p.key === e.programa);
              return [
                e.id, tipoPagoId, programa.valor_matricula, periodo,
                e.indice % 2 === 0 ? 'Transferencia' : 'Efectivo',
                `DEMO-${String(1000 + e.indice)}`, 'Pagado',
                'Pago de matrícula (dato de ejemplo)',
                new Date(Date.now() - ((e.indice % 20) + 1) * 864e5),
              ];
            })
        );
      }
    } catch (e) {
      if (e.code !== '42P01') throw e;
      console.warn('[DEMO] tipos_pago/pagos no existen; se omiten los pagos.');
    }

    await client.query('COMMIT');
    const ms = Date.now() - inicio;
    console.log(`[DEMO] Business ${businessId} sembrado en ${ms} ms`);
    return res.status(201).json({ ok: true, business_id: businessId, ms, resumen });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[DEMO] Error sembrando el business ${businessId}:`, err);
    return res.status(500).json({ error: 'Error sembrando el negocio demo.', details: err.message });
  } finally {
    client.release();
  }
};

// ==========================================
// 🧹 POST /api/demo/purge
// ==========================================
/**
 * Borra TODO el contenido académico de un negocio demo. Lo llama auth-service
 * cuando el sandbox vence, antes de eliminar el negocio en su propia base.
 *
 * El orden importa: las FK con ON DELETE CASCADE cubren casi todo desde
 * programas/materias/students, pero las tablas sin FK al negocio (grades,
 * pagos) se limpian explícitamente por sus dueños.
 */
export const purgeDemoBusiness = async (req, res) => {
  const businessId = parseInt(req.body?.business_id, 10);
  if (!businessId) return res.status(400).json({ error: 'business_id es obligatorio.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Guardia dura: solo negocios sin datos "reales" mezclados. Si alguien
    // llamara esto con el id de un cliente de verdad, este chequeo no lo
    // salva — por eso el endpoint exige el secreto interno. Aquí solo
    // dejamos constancia del tamaño de lo que se borra.
    const { rows: conteo } = await client.query(
      'SELECT COUNT(*)::int AS total FROM students WHERE business_id = $1',
      [businessId]
    );

    // Notas y pagos cuelgan de students, no del negocio.
    await client.query(
      `DELETE FROM grades WHERE student_id IN (SELECT id FROM students WHERE business_id = $1)`,
      [businessId]
    );
    try {
      await client.query(
        `DELETE FROM pagos WHERE student_id IN (SELECT id FROM students WHERE business_id = $1)`,
        [businessId]
      );
    } catch (e) {
      if (e.code !== '42P01') throw e;
    }

    // student_certificados y estudiante_clases caen por CASCADE al borrar
    // students; estudiante_programas también.
    await client.query('DELETE FROM students WHERE business_id = $1', [businessId]);

    // Evaluaciones y sus preguntas/opciones (CASCADE desde evaluaciones).
    await client.query('DELETE FROM evaluaciones WHERE business_id = $1', [businessId]);

    // Clases y PDFs caen por CASCADE desde modulos.
    await client.query('DELETE FROM modulos WHERE business_id = $1', [businessId]);

    try {
      await client.query('DELETE FROM materia_foro_posts WHERE business_id = $1', [businessId]);
    } catch (e) {
      if (e.code !== '42P01') throw e;
    }

    await client.query('DELETE FROM materias WHERE business_id = $1', [businessId]);
    await client.query('DELETE FROM cierres WHERE business_id = $1', [businessId]);
    await client.query('DELETE FROM docentes WHERE business_id = $1', [businessId]);
    await client.query('DELETE FROM programas WHERE business_id = $1', [businessId]);

    await client.query('COMMIT');
    console.log(`[DEMO] Purgado el business ${businessId} (${conteo[0].total} estudiantes).`);
    return res.json({ ok: true, business_id: businessId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[DEMO] Error purgando el business ${businessId}:`, err);
    return res.status(500).json({ error: 'Error purgando el negocio demo.', details: err.message });
  } finally {
    client.release();
  }
};
