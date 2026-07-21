// scripts/cargar_semana2.mjs
// Carga automática de la "Semana 2" de los 3 cursos en QControla, replicando la
// estructura de la Semana 1: materia -> temas (modulos) -> clases -> presentación
// HTML (GCS) + examen por tema (evaluaciones/preguntas/opciones).
//
// Fuente de verdad: el manifest.json que produce
//   CLASES/CURSO/_build/export_manifest.py
//
// SEGURIDAD: por defecto corre en DRY-RUN (no escribe nada). Para escribir de
// verdad en la base de datos de producción + GCS hay que pasar --commit.
//
// Uso:
//   node scripts/cargar_semana2.mjs                 # dry-run, los 3 cursos
//   node scripts/cargar_semana2.mjs --course=1      # dry-run, solo course1
//   node scripts/cargar_semana2.mjs --course=1 --commit   # escribe course1
//   node scripts/cargar_semana2.mjs --commit --force      # escribe los 3 aunque exista la materia
//
// Opciones:
//   --manifest=<ruta>   ruta al manifest.json (por defecto la de CLASES/CURSO)
import pkg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { uploadClasePresentacionToGCS, deleteClasePresentacionFromGCS } from "../src/services/gcsClases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// ---- args ----
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : def;
};
const COMMIT = has("--commit");
const FORCE = has("--force");
const courseArg = val("course", "all"); // "all" | "1" | "2" | "3" | "course1"...
const MANIFEST = val("manifest", "C:/Users/ASUS/Documents/CLASES/CURSO/_build/manifest.json");

const wantCourse = (key) => {
  if (courseArg === "all") return true;
  return key === courseArg || key === `course${courseArg}`;
};

const pool = new pkg.Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

const log = (...a) => console.log(...a);
const tag = COMMIT ? "COMMIT" : "DRY-RUN";

async function cargarCurso(client, curso, businessId, docenteId) {
  log(`\n──────── ${curso.key} · "${curso.materia_suggested}"  (programa ${curso.programa_id} · ${curso.programa_nombre}) ────────`);

  // Idempotencia: ¿ya existe una materia con ese nombre en ese programa/negocio?
  const { rows: existentes } = await client.query(
    `SELECT id FROM materias WHERE nombre=$1 AND programa_id=$2 AND business_id=$3`,
    [curso.materia_suggested, curso.programa_id, businessId]
  );
  if (existentes.length && !FORCE) {
    log(`  ⚠  Ya existe la materia [${existentes[0].id}] con ese nombre. Se OMITE (usa --force para crear otra).`);
    return { skipped: true };
  }

  // Verificar que todos los HTML existen antes de tocar nada
  for (const t of curso.temas)
    for (const cl of t.clases) {
      const ruta = path.join(curso.html_dir, cl.html_file);
      if (!fs.existsSync(ruta)) throw new Error(`No existe el HTML: ${ruta}`);
    }

  const totalClases = curso.temas.reduce((n, t) => n + t.clases.length, 0);
  const totalPreg = curso.temas.reduce((n, t) => n + t.examen.preguntas.length, 0);
  log(`  Plan: 1 materia · ${curso.temas.length} temas · ${totalClases} clases (${totalClases} HTML a GCS) · ${curso.temas.length} exámenes (${totalPreg} preguntas)`);

  if (!COMMIT) {
    for (const t of curso.temas) {
      log(`    Tema ${t.orden}: "${t.titulo}"  (${t.clases.length} clases, examen ${t.examen.preguntas.length} preg)`);
      for (const cl of t.clases) log(`        Clase ${cl.orden}: "${cl.titulo}"  <- ${cl.html_file}`);
    }
    return { skipped: false, dryRun: true };
  }

  // ---- ESCRITURA REAL ----
  const gcsSubidos = []; // para limpiar si algo falla
  try {
    await client.query("BEGIN");

    const { rows: matRows } = await client.query(
      `INSERT INTO materias (nombre, programa_id, docente_id, business_id, activa)
       VALUES ($1,$2,$3,$4,true) RETURNING id`,
      [curso.materia_suggested, curso.programa_id, docenteId, businessId]
    );
    const materiaId = matRows[0].id;
    log(`  ✔ materia [${materiaId}]`);

    for (const t of curso.temas) {
      const { rows: modRows } = await client.query(
        `INSERT INTO modulos (titulo, descripcion, contenido, activa, orden, programa_id, materia_id, business_id)
         VALUES ($1,NULL,NULL,true,$2,$3,$4,$5) RETURNING id`,
        [t.titulo, t.orden, curso.programa_id, materiaId, businessId]
      );
      const moduloId = modRows[0].id;
      log(`    ✔ tema [${moduloId}] "${t.titulo}"`);

      for (const cl of t.clases) {
        const { rows: claseRows } = await client.query(
          `INSERT INTO clases (modulo_id, business_id, titulo, descripcion, orden, activa)
           VALUES ($1,$2,$3,NULL,$4,true) RETURNING id`,
          [moduloId, businessId, cl.titulo, cl.orden]
        );
        const claseId = claseRows[0].id;

        // Subir el HTML como presentación (tipo html) a GCS
        const buffer = fs.readFileSync(path.join(curso.html_dir, cl.html_file));
        const { publicUrl, gcsPath } = await uploadClasePresentacionToGCS(buffer, {
          filename: cl.html_file,
          mimetype: "text/html; charset=utf-8",
          claseId,
        });
        gcsSubidos.push(gcsPath);

        await client.query(
          `INSERT INTO clase_presentaciones (clase_id, modulo_id, business_id, nombre, tipo, url, gcs_path, orden)
           VALUES ($1,$2,$3,$4,'html',$5,$6,0)`,
          [claseId, moduloId, businessId, cl.html_file, publicUrl, gcsPath]
        );
      }
      log(`        ✔ ${t.clases.length} clases + HTML`);

      // Examen del tema
      const ex = t.examen;
      const { rows: evalRows } = await client.query(
        `INSERT INTO evaluaciones
           (titulo, descripcion, tipo_destino, programa_id, materia_id,
            fecha_inicio, fecha_fin, intentos_max, tiempo_limite_min, activa, business_id)
         VALUES ($1,NULL,NULL,$2,$3,NULL,NULL,$4,$5,true,$6) RETURNING id`,
        [ex.titulo, curso.programa_id, materiaId, ex.intentos_max, ex.tiempo_limite_min, businessId]
      );
      const evalId = evalRows[0].id;

      await client.query(
        `INSERT INTO evaluacion_programas (evaluacion_id, programa_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [evalId, curso.programa_id]
      );

      for (const p of ex.preguntas) {
        const { rows: pregRows } = await client.query(
          `INSERT INTO evaluacion_preguntas
             (evaluacion_id, enunciado, tipo_pregunta, es_obligatoria, puntaje, orden)
           VALUES ($1,$2,$3,true,$4,$5) RETURNING id`,
          [evalId, p.enunciado, p.tipo_pregunta, p.puntaje, p.orden]
        );
        const pregId = pregRows[0].id;
        for (const o of p.opciones) {
          await client.query(
            `INSERT INTO evaluacion_opciones (pregunta_id, texto, es_correcta, orden)
             VALUES ($1,$2,$3,$4)`,
            [pregId, o.texto, o.es_correcta, o.orden]
          );
        }
      }

      await client.query(
        `INSERT INTO modulo_evaluaciones (modulo_id, evaluacion_id, es_requerida)
         VALUES ($1,$2,true) ON CONFLICT (modulo_id, evaluacion_id) DO NOTHING`,
        [moduloId, evalId]
      );
      log(`        ✔ examen [${evalId}] (${ex.preguntas.length} preguntas)`);
    }

    await client.query("COMMIT");
    log(`  ✅ ${curso.key} cargado (materia ${materiaId}).`);
    return { skipped: false, materiaId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // Limpiar archivos GCS que quedaron huérfanos por el rollback
    for (const gp of gcsSubidos) await deleteClasePresentacionFromGCS(gp).catch(() => {});
    throw err;
  }
}

async function main() {
  if (!fs.existsSync(MANIFEST)) throw new Error(`No se encontró el manifest: ${MANIFEST}`);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf-8"));
  const { business_id: businessId, docente_id: docenteId } = manifest;

  log(`=== Cargar Semana ${manifest.week ?? "?"} en QControla · modo ${tag} ===`);
  log(`Manifest: ${MANIFEST}`);
  log(`Negocio: ${businessId} · Docente: ${docenteId} · DB: ${process.env.PGDATABASE}@${process.env.PGHOST}`);
  if (!COMMIT) log("(DRY-RUN: no se escribe nada. Añade --commit para ejecutar de verdad.)");

  const client = await pool.connect();
  const resumen = [];
  try {
    for (const curso of manifest.courses) {
      if (!wantCourse(curso.key)) continue;
      const r = await cargarCurso(client, curso, businessId, docenteId);
      resumen.push({ key: curso.key, ...r });
    }
  } finally {
    client.release();
    await pool.end();
  }

  log("\n=== Resumen ===");
  for (const r of resumen) {
    if (r.skipped) log(`  ${r.key}: OMITIDO (ya existía)`);
    else if (r.dryRun) log(`  ${r.key}: dry-run OK`);
    else log(`  ${r.key}: CARGADO (materia ${r.materiaId})`);
  }
  if (!COMMIT) log("\nNada fue escrito. Revisa el plan y vuelve a correr con --commit cuando estés listo.");
}

main().catch((e) => { console.error("\n❌ Error:", e.message); process.exit(1); });
