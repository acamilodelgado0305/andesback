import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = pkg;
const pool = new Pool({
  host: process.env.PGHOST, database: process.env.PGDATABASE,
  user: process.env.PGUSER, password: process.env.PGPASSWORD,
  port: 5432, ssl: { rejectUnauthorized: false },
});

// Réplica EXACTA de los INSERT del controlador duplicarMateria, pero SIN copiar GCS
// (se comparte la url) y con ROLLBACK final: NO persiste absolutamente nada.
const dryRun = async (id, businessId, programa_id_destino) => {
  const client = await pool.connect();
  const counts = { materia: 0, temas: 0, clases: 0, evals: 0, preguntas: 0, opciones: 0, pdfs: 0, presentaciones: 0, modEvalLinks: 0 };
  try {
    const { rows: matRows } = await client.query('SELECT * FROM "public"."materias" WHERE id=$1 AND business_id=$2', [id, businessId]);
    if (!matRows.length) throw new Error("materia origen no encontrada");
    const origen = matRows[0];

    await client.query('BEGIN');

    const { rows: nm } = await client.query(
      `INSERT INTO "public"."materias" (nombre, programa_id, docente_id, business_id, activa)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [(origen.nombre||'') + ' (COPIA DRYRUN)', programa_id_destino, origen.docente_id, businessId, origen.activa]);
    const nuevaMateria = nm[0]; counts.materia = 1;

    // Evaluaciones
    const { rows: evalRows } = await client.query(
      `SELECT DISTINCT e.* FROM "public"."evaluaciones" e
        WHERE e.business_id=$2 AND (e.materia_id=$1 OR e.id IN (
          SELECT me.evaluacion_id FROM "public"."modulo_evaluaciones" me
          JOIN "public"."modulos" m ON m.id=me.modulo_id WHERE m.materia_id=$1))`,
      [id, businessId]);
    const evalMap = new Map();
    for (const ev of evalRows) {
      const { rows: ne } = await client.query(
        `INSERT INTO "public"."evaluaciones"
          (titulo, descripcion, tipo_destino, programa_id, materia_id, fecha_inicio, fecha_fin,
           intentos_max, tiempo_limite_min, activa, business_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [ev.titulo, ev.descripcion, ev.tipo_destino, programa_id_destino, nuevaMateria.id,
         ev.fecha_inicio, ev.fecha_fin, ev.intentos_max, ev.tiempo_limite_min, ev.activa, businessId]);
      const newEvalId = ne[0].id; evalMap.set(ev.id, newEvalId); counts.evals++;
      await client.query(`INSERT INTO "public"."evaluacion_programas" (evaluacion_id, programa_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [newEvalId, programa_id_destino]);
      const { rows: preguntas } = await client.query('SELECT * FROM "public"."evaluacion_preguntas" WHERE evaluacion_id=$1 ORDER BY orden ASC, id ASC', [ev.id]);
      for (const p of preguntas) {
        const { rows: np } = await client.query(
          `INSERT INTO "public"."evaluacion_preguntas" (evaluacion_id, enunciado, tipo_pregunta, es_obligatoria, puntaje, orden)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [newEvalId, p.enunciado, p.tipo_pregunta, p.es_obligatoria, p.puntaje, p.orden]);
        const newPregId = np[0].id; counts.preguntas++;
        const { rows: opciones } = await client.query('SELECT * FROM "public"."evaluacion_opciones" WHERE pregunta_id=$1 ORDER BY orden ASC, id ASC', [p.id]);
        for (const o of opciones) {
          await client.query(`INSERT INTO "public"."evaluacion_opciones" (pregunta_id, texto, es_correcta, orden) VALUES ($1,$2,$3,$4)`, [newPregId, o.texto, o.es_correcta, o.orden]);
          counts.opciones++;
        }
      }
    }

    // Temas + clases + pdfs + presentaciones + links
    const { rows: modulos } = await client.query('SELECT * FROM "public"."modulos" WHERE materia_id=$1 AND business_id=$2 ORDER BY orden ASC, created_at ASC', [id, businessId]);
    for (const m of modulos) {
      const { rows: nmod } = await client.query(
        `INSERT INTO "public"."modulos" (titulo, descripcion, contenido, activa, orden, programa_id, materia_id, business_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [m.titulo, m.descripcion, m.contenido, m.activa, m.orden, programa_id_destino, nuevaMateria.id, businessId]);
      const newModuloId = nmod[0].id; counts.temas++;

      const { rows: clases } = await client.query('SELECT * FROM "public"."clases" WHERE modulo_id=$1 ORDER BY orden ASC, created_at ASC', [m.id]);
      for (const c of clases) {
        const { rows: nc } = await client.query(
          `INSERT INTO "public"."clases" (modulo_id, business_id, titulo, descripcion, orden, activa) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [newModuloId, businessId, c.titulo, c.descripcion, c.orden, c.activa]);
        const newClaseId = nc[0].id; counts.clases++;
        if (c.video_url || c.video_gcs_path) {
          await client.query('UPDATE "public"."clases" SET video_url=$1, video_gcs_path=$2 WHERE id=$3', [c.video_url || null, null, newClaseId]);
        }
        const { rows: clasePdfs } = await client.query('SELECT * FROM "public"."modulo_pdfs" WHERE clase_id=$1 ORDER BY orden ASC, created_at ASC', [c.id]);
        for (const pdf of clasePdfs) {
          await client.query(`INSERT INTO "public"."modulo_pdfs" (modulo_id, clase_id, nombre, pdf_url, gcs_path, orden, business_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [newModuloId, newClaseId, pdf.nombre, pdf.pdf_url || null, null, pdf.orden, businessId]);
          counts.pdfs++;
        }
        try {
          const { rows: pres } = await client.query('SELECT * FROM "public"."clase_presentaciones" WHERE clase_id=$1 ORDER BY orden ASC, created_at ASC', [c.id]);
          for (const pr of pres) {
            await client.query(`INSERT INTO "public"."clase_presentaciones" (clase_id, modulo_id, business_id, nombre, tipo, url, gcs_path, orden) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [newClaseId, newModuloId, businessId, pr.nombre, pr.tipo, pr.url || null, null, pr.orden]);
            counts.presentaciones++;
          }
        } catch (e) { if (e.code !== '42P01') throw e; }
      }

      const { rows: temaPdfs } = await client.query('SELECT * FROM "public"."modulo_pdfs" WHERE modulo_id=$1 AND clase_id IS NULL ORDER BY orden ASC, created_at ASC', [m.id]);
      for (const pdf of temaPdfs) {
        await client.query(`INSERT INTO "public"."modulo_pdfs" (modulo_id, clase_id, nombre, pdf_url, gcs_path, orden, business_id) VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
          [newModuloId, pdf.nombre, pdf.pdf_url || null, null, pdf.orden, businessId]);
        counts.pdfs++;
      }

      const { rows: modEvals } = await client.query('SELECT * FROM "public"."modulo_evaluaciones" WHERE modulo_id=$1', [m.id]);
      for (const me of modEvals) {
        const newEvalId = evalMap.get(me.evaluacion_id);
        if (!newEvalId) continue;
        await client.query(`INSERT INTO "public"."modulo_evaluaciones" (modulo_id, evaluacion_id, es_requerida) VALUES ($1,$2,$3) ON CONFLICT (modulo_id, evaluacion_id) DO NOTHING`,
          [newModuloId, newEvalId, me.es_requerida]);
        counts.modEvalLinks++;
      }
    }

    await client.query('ROLLBACK'); // NO persistir nada
    console.log("DRY-RUN OK (rolled back). Se habrían insertado:");
    console.table(counts);
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error("DRY-RUN FALLÓ con error real de INSERT/esquema:");
    console.error("  code:", e.code, "| message:", e.message, "| column:", e.column, "| table:", e.table, "| constraint:", e.constraint);
  } finally {
    client.release();
  }
};

const run = async () => {
  // materia 246 (5 temas, 30 clases, 5 evals) hacia su mismo programa destino no importa; uso un programa real del negocio 44
  const { rows: prog } = await pool.query('SELECT id FROM "public"."programas" WHERE business_id=1 ORDER BY id ASC LIMIT 1');
  const destino = prog[0]?.id;
  console.log("programa destino (negocio 44):", destino);
  await dryRun(258, 1, 3);
  await dryRun(255, 1, 3);
  await pool.end();
};
run().catch(e => { console.error(e); process.exit(1); });
