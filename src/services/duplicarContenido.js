// src/services/duplicarContenido.js
//
// Motor de COPIA PROFUNDA del contenido académico, compartido por:
//   • POST /api/materias/:id/duplicar  → clona una materia en otros programas
//   • POST /api/modulos/:id/duplicar   → clona un tema en otras materias
//
// Todas las funciones reciben el `client` de pg y corren DENTRO de la transacción
// que abre el llamador: si algo falla, el llamador hace ROLLBACK.
//
// Qué se copia: materia → temas (modulos) → clases (con video) → PDFs (de clase y
// de tema) → presentaciones → evaluaciones (con preguntas/opciones) + los links
// tema→evaluación. Los archivos de GCS se copian FÍSICAMENTE (copia server-side)
// para que la copia sea 100% independiente del original.
//
// Qué NO se copia: estudiantes, progreso, asignaciones ni foro. Los estudiantes del
// destino reciben el contenido por la auto-asignación perezosa ya existente
// (getModulosDeEstudiante / getEvaluacionesDeEstudiante).

import {
  copyMateriaBanner, copyModuloPdf, copyClaseVideo, copyClasePdf, copyClasePresentacion,
} from './gcsCopy.js';

// Copia un archivo de GCS si tiene gcs_path; si es un enlace externo (solo url)
// lo referencia tal cual. Si la copia falla, cae a referenciar la url original
// (best-effort: la duplicación no se aborta por un archivo).
export const dupFile = async ({ gcsPath, url }, copyFn, ...args) => {
  if (gcsPath) {
    try {
      const copied = await copyFn(gcsPath, ...args);
      if (copied) return copied;
    } catch (e) {
      console.warn('[duplicarContenido] Falló copia GCS, se comparte el archivo original:', e.message);
    }
    // Fallback: si la copia falla, se COMPARTE el archivo original (mismo
    // gcs_path/url) en vez de devolver null. Algunas tablas (p. ej. modulo_pdfs)
    // tienen gcs_path NOT NULL: insertar null abortaría TODA la transacción de
    // duplicado (y la copia quedaría "vacía", solo con el nombre).
    return { publicUrl: url || null, gcsPath };
  }
  // Sin gcs_path → enlace externo (YouTube/Loom/...) o vacío: se comparte la url.
  return { publicUrl: url || null, gcsPath: null };
};

// Clona una evaluación completa (preguntas + opciones + link al programa destino).
// Devuelve el id de la evaluación nueva.
export const clonarEvaluacion = async (client, { ev, businessId, programaDestinoId, materiaDestinoId }) => {
  const { rows: nuevaEvalRows } = await client.query(
    `INSERT INTO "public"."evaluaciones"
       (titulo, descripcion, tipo_destino, programa_id, materia_id, fecha_inicio, fecha_fin,
        intentos_max, tiempo_limite_min, activa, business_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [ev.titulo, ev.descripcion, ev.tipo_destino, programaDestinoId, materiaDestinoId,
     ev.fecha_inicio, ev.fecha_fin, ev.intentos_max, ev.tiempo_limite_min, ev.activa, businessId]
  );
  const newEvalId = nuevaEvalRows[0].id;

  await client.query(
    `INSERT INTO "public"."evaluacion_programas" (evaluacion_id, programa_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [newEvalId, programaDestinoId]
  );

  // Preguntas + opciones
  const { rows: preguntas } = await client.query(
    'SELECT * FROM "public"."evaluacion_preguntas" WHERE evaluacion_id = $1 ORDER BY orden ASC, id ASC',
    [ev.id]
  );
  for (const p of preguntas) {
    const { rows: nuevaPregRows } = await client.query(
      `INSERT INTO "public"."evaluacion_preguntas"
         (evaluacion_id, enunciado, tipo_pregunta, es_obligatoria, puntaje, orden)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [newEvalId, p.enunciado, p.tipo_pregunta, p.es_obligatoria, p.puntaje, p.orden]
    );
    const newPregId = nuevaPregRows[0].id;
    const { rows: opciones } = await client.query(
      'SELECT * FROM "public"."evaluacion_opciones" WHERE pregunta_id = $1 ORDER BY orden ASC, id ASC',
      [p.id]
    );
    for (const o of opciones) {
      await client.query(
        `INSERT INTO "public"."evaluacion_opciones" (pregunta_id, texto, es_correcta, orden)
         VALUES ($1,$2,$3,$4)`,
        [newPregId, o.texto, o.es_correcta, o.orden]
      );
    }
  }

  return newEvalId;
};

// Clona un tema (modulo) con sus clases, videos, PDFs, presentaciones y exámenes
// dentro de `materiaDestinoId`. Devuelve el id del tema nuevo.
//
//   evalMap  Map srcEvalId→newEvalId ya construido por el llamador (caso "duplicar
//            materia": las evaluaciones se clonan una sola vez para toda la materia).
//            Si es null, este helper clona por su cuenta las evaluaciones vinculadas
//            al tema (caso "duplicar tema" suelto).
//   orden    posición en la materia destino. Si no se pasa, se agrega al final.
export const clonarModuloEnMateria = async (client, {
  modulo, businessId, materiaDestinoId, programaDestinoId, evalMap = null, orden,
}) => {
  // Evaluaciones vinculadas al tema (solo cuando el llamador no trae un mapa hecho)
  let mapaEvals = evalMap;
  if (!mapaEvals) {
    mapaEvals = new Map();
    const { rows: evalsDelTema } = await client.query(
      `SELECT e.*
         FROM "public"."evaluaciones" e
         JOIN "public"."modulo_evaluaciones" me ON me.evaluacion_id = e.id
        WHERE me.modulo_id = $1 AND e.business_id = $2`,
      [modulo.id, businessId]
    );
    for (const ev of evalsDelTema) {
      const newEvalId = await clonarEvaluacion(client, {
        ev, businessId, programaDestinoId, materiaDestinoId,
      });
      mapaEvals.set(ev.id, newEvalId);
    }
  }

  // Posición: al final de la materia destino si no la impone el llamador.
  let ordenFinal = orden;
  if (ordenFinal === undefined || ordenFinal === null) {
    const { rows: ordRows } = await client.query(
      'SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM "public"."modulos" WHERE materia_id = $1',
      [materiaDestinoId]
    );
    ordenFinal = ordRows[0].siguiente;
  }

  const { rows: nuevoModRows } = await client.query(
    `INSERT INTO "public"."modulos"
       (titulo, descripcion, contenido, activa, orden, programa_id, materia_id, business_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [modulo.titulo, modulo.descripcion, modulo.contenido, modulo.activa, ordenFinal,
     programaDestinoId, materiaDestinoId, businessId]
  );
  const newModuloId = nuevoModRows[0].id;

  // 1. Clases del tema (cada una con su video, PDFs y presentaciones)
  const { rows: clases } = await client.query(
    'SELECT * FROM "public"."clases" WHERE modulo_id = $1 ORDER BY orden ASC, created_at ASC',
    [modulo.id]
  );
  for (const c of clases) {
    const { rows: nuevaClaseRows } = await client.query(
      `INSERT INTO "public"."clases" (modulo_id, business_id, titulo, descripcion, orden, activa)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [newModuloId, businessId, c.titulo, c.descripcion, c.orden, c.activa]
    );
    const newClaseId = nuevaClaseRows[0].id;

    // Video (GCS → copia física; enlace externo → se comparte)
    if (c.video_url || c.video_gcs_path) {
      const vid = await dupFile(
        { gcsPath: c.video_gcs_path, url: c.video_url },
        copyClaseVideo, newClaseId, c.video_url
      );
      await client.query(
        'UPDATE "public"."clases" SET video_url = $1, video_gcs_path = $2 WHERE id = $3',
        [vid.publicUrl, vid.gcsPath, newClaseId]
      );
    }

    // PDFs de la clase
    const { rows: clasePdfs } = await client.query(
      'SELECT * FROM "public"."modulo_pdfs" WHERE clase_id = $1 ORDER BY orden ASC, created_at ASC',
      [c.id]
    );
    for (const pdf of clasePdfs) {
      const copied = await dupFile({ gcsPath: pdf.gcs_path, url: pdf.pdf_url }, copyClasePdf, newClaseId, pdf.nombre);
      // modulo_pdfs.pdf_url y gcs_path son NOT NULL: si la copia no devolvió
      // valores se referencian los del PDF original para no romper el INSERT.
      await client.query(
        `INSERT INTO "public"."modulo_pdfs" (modulo_id, clase_id, nombre, pdf_url, gcs_path, orden, business_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newModuloId, newClaseId, pdf.nombre, copied.publicUrl ?? pdf.pdf_url, copied.gcsPath ?? pdf.gcs_path, pdf.orden, businessId]
      );
    }

    // Presentaciones de la clase (tolerar que la tabla aún no exista → migración pendiente)
    try {
      const { rows: pres } = await client.query(
        'SELECT * FROM "public"."clase_presentaciones" WHERE clase_id = $1 ORDER BY orden ASC, created_at ASC',
        [c.id]
      );
      for (const pr of pres) {
        const copied = await dupFile({ gcsPath: pr.gcs_path, url: pr.url }, copyClasePresentacion, newClaseId, pr.nombre);
        await client.query(
          `INSERT INTO "public"."clase_presentaciones" (clase_id, modulo_id, business_id, nombre, tipo, url, gcs_path, orden)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [newClaseId, newModuloId, businessId, pr.nombre, pr.tipo, copied.publicUrl, copied.gcsPath, pr.orden]
        );
      }
    } catch (e) {
      if (e.code !== '42P01') throw e;
    }
  }

  // 2. PDFs a nivel tema (clase_id IS NULL, "legacy")
  const { rows: temaPdfs } = await client.query(
    'SELECT * FROM "public"."modulo_pdfs" WHERE modulo_id = $1 AND clase_id IS NULL ORDER BY orden ASC, created_at ASC',
    [modulo.id]
  );
  for (const pdf of temaPdfs) {
    const copied = await dupFile({ gcsPath: pdf.gcs_path, url: pdf.pdf_url }, copyModuloPdf, newModuloId, pdf.nombre);
    // modulo_pdfs.pdf_url y gcs_path son NOT NULL (ver nota arriba).
    await client.query(
      `INSERT INTO "public"."modulo_pdfs" (modulo_id, clase_id, nombre, pdf_url, gcs_path, orden, business_id)
       VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
      [newModuloId, pdf.nombre, copied.publicUrl ?? pdf.pdf_url, copied.gcsPath ?? pdf.gcs_path, pdf.orden, businessId]
    );
  }

  // 3. Links tema → evaluación (mapeando al nuevo id de evaluación)
  const { rows: modEvals } = await client.query(
    'SELECT * FROM "public"."modulo_evaluaciones" WHERE modulo_id = $1',
    [modulo.id]
  );
  for (const me of modEvals) {
    const newEvalId = mapaEvals.get(me.evaluacion_id);
    if (!newEvalId) continue;
    await client.query(
      `INSERT INTO "public"."modulo_evaluaciones" (modulo_id, evaluacion_id, es_requerida)
       VALUES ($1,$2,$3) ON CONFLICT (modulo_id, evaluacion_id) DO NOTHING`,
      [newModuloId, newEvalId, me.es_requerida]
    );
  }

  return newModuloId;
};

// Clona la materia `origen` (id = materiaId) entera dentro de `programaDestinoId`.
export const clonarMateriaEnPrograma = async (client, {
  origen, materiaId, businessId, programaDestinoId, nombre,
}) => {
  // 1. Nueva materia
  const { rows: nuevaMatRows } = await client.query(
    `INSERT INTO "public"."materias" (nombre, programa_id, docente_id, business_id, activa)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [nombre?.trim() || origen.nombre, programaDestinoId, origen.docente_id, businessId, origen.activa]
  );
  const nuevaMateria = nuevaMatRows[0];

  // 2. Banner (best-effort)
  if (origen.banner_gcs_path) {
    const b = await dupFile(
      { gcsPath: origen.banner_gcs_path, url: origen.banner_url },
      copyMateriaBanner, nuevaMateria.id, origen.banner_url
    );
    await client.query(
      'UPDATE "public"."materias" SET banner_url = $1, banner_gcs_path = $2 WHERE id = $3',
      [b.publicUrl, b.gcsPath, nuevaMateria.id]
    );
    nuevaMateria.banner_url = b.publicUrl;
    nuevaMateria.banner_gcs_path = b.gcsPath;
  }

  // 3. Evaluaciones de la materia (por materia_id o vinculadas a sus temas).
  //    Se clonan UNA sola vez y se comparten entre los temas vía evalMap.
  const { rows: evalRows } = await client.query(
    `SELECT DISTINCT e.*
       FROM "public"."evaluaciones" e
      WHERE e.business_id = $2 AND (
        e.materia_id = $1
        OR e.id IN (
          SELECT me.evaluacion_id FROM "public"."modulo_evaluaciones" me
          JOIN "public"."modulos" m ON m.id = me.modulo_id
          WHERE m.materia_id = $1
        )
      )`,
    [materiaId, businessId]
  );

  const evalMap = new Map(); // srcEvalId → newEvalId
  for (const ev of evalRows) {
    const newEvalId = await clonarEvaluacion(client, {
      ev, businessId, programaDestinoId, materiaDestinoId: nuevaMateria.id,
    });
    evalMap.set(ev.id, newEvalId);
  }

  // 4. Temas (modulos) — conservando el orden original de la materia
  const { rows: modulos } = await client.query(
    'SELECT * FROM "public"."modulos" WHERE materia_id = $1 AND business_id = $2 ORDER BY orden ASC, created_at ASC',
    [materiaId, businessId]
  );
  for (const m of modulos) {
    await clonarModuloEnMateria(client, {
      modulo: m,
      businessId,
      materiaDestinoId: nuevaMateria.id,
      programaDestinoId,
      evalMap,
      orden: m.orden,
    });
  }

  return nuevaMateria;
};
