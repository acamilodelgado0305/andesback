// scripts/inspeccionar_academico.mjs
// SOLO LECTURA. Inspecciona programas y la estructura de las materias (Semana 1)
// para replicar sus convenciones al cargar la Semana 2. No escribe nada.
// Uso:  node scripts/inspeccionar_academico.mjs
import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { Pool } = pkg;
const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

const line = (s = "") => console.log(s);

async function main() {
  // 1) Programas
  const { rows: programas } = await pool.query(
    `SELECT id, nombre, tipo_programa, business_id
       FROM programas ORDER BY business_id, nombre`
  );
  line("========== PROGRAMAS ==========");
  for (const p of programas) {
    line(`  [${p.id}] biz=${p.business_id}  tipo=${p.tipo_programa || "-"}  ${p.nombre}`);
  }

  // 2) Materias con su programa y contadores
  const { rows: materias } = await pool.query(
    `SELECT m.id, m.nombre, m.programa_id, m.business_id, m.activa, m.docente_id,
            p.nombre AS programa_nombre,
            (SELECT COUNT(*) FROM modulos md WHERE md.materia_id = m.id) AS temas,
            (SELECT COUNT(*) FROM evaluaciones e WHERE e.materia_id = m.id) AS evals
       FROM materias m
       LEFT JOIN programas p ON p.id = m.programa_id
       ORDER BY p.nombre, m.id`
  );
  line("\n========== MATERIAS ==========");
  for (const m of materias) {
    line(`  [${m.id}] biz=${m.business_id} prog=[${m.programa_id}] ${m.programa_nombre} :: "${m.nombre}"  (activa=${m.activa}, docente=${m.docente_id || "-"}, temas=${m.temas}, evals=${m.evals})`);
  }

  // 3) Estructura detallada de las materias que parecen "Semana 1" o de nuestros 3 cursos
  const claves = ["semana 1", "semana 2", "javascript", "ofim", "dise", "programa", "desarrollo web", "marca", "motion", "redes"];
  const objetivo = materias.filter((m) =>
    claves.some((k) => (m.nombre || "").toLowerCase().includes(k) || (m.programa_nombre || "").toLowerCase().includes(k))
  );

  for (const m of objetivo) {
    line(`\n========== ESTRUCTURA materia [${m.id}] "${m.nombre}"  (prog ${m.programa_id} · ${m.programa_nombre}) ==========`);
    const { rows: temas } = await pool.query(
      `SELECT id, titulo, orden, activa,
              LEFT(COALESCE(descripcion,''),60) AS descripcion,
              (contenido IS NOT NULL AND contenido <> '') AS tiene_contenido
         FROM modulos WHERE materia_id=$1 ORDER BY orden, created_at`,
      [m.id]
    );
    for (const t of temas) {
      line(`  Tema [${t.id}] orden=${t.orden} "${t.titulo}" (activa=${t.activa}, contenido=${t.tiene_contenido})`);
      const { rows: clases } = await pool.query(
        `SELECT c.id, c.titulo, c.orden, c.video_url,
                (SELECT COUNT(*) FROM clase_presentaciones cp WHERE cp.clase_id=c.id) AS pres,
                (SELECT string_agg(DISTINCT cp.tipo, ',') FROM clase_presentaciones cp WHERE cp.clase_id=c.id) AS tipos
           FROM clases c WHERE c.modulo_id=$1 ORDER BY c.orden, c.created_at`,
        [t.id]
      );
      for (const c of clases) {
        line(`      Clase [${c.id}] orden=${c.orden} "${c.titulo}" pres=${c.pres}${c.tipos ? ` (${c.tipos})` : ""}${c.video_url ? " video" : ""}`);
      }
      // Evaluaciones ligadas al tema
      const { rows: evs } = await pool.query(
        `SELECT e.id, e.titulo, e.tipo_destino, e.activa, e.intentos_max, e.tiempo_limite_min,
                (SELECT COUNT(*) FROM evaluacion_preguntas ep WHERE ep.evaluacion_id=e.id) AS preguntas
           FROM modulo_evaluaciones me JOIN evaluaciones e ON e.id=me.evaluacion_id
          WHERE me.modulo_id=$1`,
        [t.id]
      );
      for (const e of evs) {
        line(`        Examen [${e.id}] "${e.titulo}" tipo_destino=${e.tipo_destino} preguntas=${e.preguntas} intentos=${e.intentos_max} tiempo=${e.tiempo_limite_min}`);
      }
    }

    // Muestra una presentación real (para ver nombre/tipo/orden/url)
    const { rows: muestra } = await pool.query(
      `SELECT cp.id, cp.clase_id, cp.nombre, cp.tipo, cp.orden, LEFT(cp.url,80) AS url, LEFT(cp.gcs_path,80) AS gcs_path
         FROM clase_presentaciones cp
         JOIN clases c ON c.id=cp.clase_id
         JOIN modulos md ON md.id=c.modulo_id
        WHERE md.materia_id=$1 ORDER BY cp.id LIMIT 3`,
      [m.id]
    );
    if (muestra.length) {
      line("    -- muestra clase_presentaciones:");
      for (const s of muestra) line(`       {tipo:${s.tipo}, nombre:"${s.nombre}", orden:${s.orden}, gcs:${s.gcs_path}}`);
    }

    // Muestra una evaluación completa (pregunta + opciones) para ver el formato
    const { rows: ev1 } = await pool.query(
      `SELECT id, titulo FROM evaluaciones WHERE materia_id=$1 ORDER BY id LIMIT 1`, [m.id]
    );
    if (ev1.length) {
      const { rows: pregs } = await pool.query(
        `SELECT id, enunciado, tipo_pregunta, puntaje, orden FROM evaluacion_preguntas WHERE evaluacion_id=$1 ORDER BY orden LIMIT 2`,
        [ev1[0].id]
      );
      line(`    -- muestra evaluación [${ev1[0].id}] "${ev1[0].titulo}":`);
      for (const pr of pregs) {
        line(`       P(${pr.tipo_pregunta}, pts=${pr.puntaje}, orden=${pr.orden}): ${pr.enunciado}`);
        const { rows: ops } = await pool.query(
          `SELECT texto, es_correcta, orden FROM evaluacion_opciones WHERE pregunta_id=$1 ORDER BY orden`, [pr.id]
        );
        for (const o of ops) line(`           - [${o.es_correcta ? "X" : " "}] (${o.orden}) ${o.texto}`);
      }
    }
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
