// scripts/verificar_materia.mjs  (SOLO LECTURA)
// Verifica la estructura cargada de una materia: temas, clases, que cada clase
// tenga exactamente 1 presentación html, y que cada tema tenga su examen.
// Uso:  node scripts/verificar_materia.mjs --materia=272
import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const materiaId = Number((process.argv.find((a) => a.startsWith("--materia=")) || "").split("=")[1]);
if (!materiaId) { console.error("Falta --materia=<id>"); process.exit(1); }

const pool = new pkg.Pool({ host: process.env.PGHOST, database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD, port: 5432, ssl: { rejectUnauthorized: false } });

const { rows: mat } = await pool.query(`SELECT id, nombre, programa_id, business_id, docente_id, activa FROM materias WHERE id=$1`, [materiaId]);
if (!mat.length) { console.error("Materia no encontrada"); process.exit(1); }
console.log(`Materia [${mat[0].id}] "${mat[0].nombre}"  prog=${mat[0].programa_id} biz=${mat[0].business_id} docente=${mat[0].docente_id} activa=${mat[0].activa}`);

const { rows: temas } = await pool.query(`SELECT id, titulo, orden FROM modulos WHERE materia_id=$1 ORDER BY orden`, [materiaId]);
let problemas = 0, totalClases = 0, primeraUrl = null;
for (const t of temas) {
  const { rows: clases } = await pool.query(
    `SELECT c.id, c.titulo, c.orden,
            (SELECT COUNT(*) FROM clase_presentaciones cp WHERE cp.clase_id=c.id AND cp.tipo='html') AS html,
            (SELECT url FROM clase_presentaciones cp WHERE cp.clase_id=c.id ORDER BY id LIMIT 1) AS url
       FROM clases c WHERE c.modulo_id=$1 ORDER BY c.orden`, [t.id]);
  const { rows: ev } = await pool.query(
    `SELECT e.id, (SELECT COUNT(*) FROM evaluacion_preguntas ep WHERE ep.evaluacion_id=e.id) AS preg
       FROM modulo_evaluaciones me JOIN evaluaciones e ON e.id=me.evaluacion_id WHERE me.modulo_id=$1`, [t.id]);
  const examTxt = ev.length ? `examen [${ev[0].id}] ${ev[0].preg} preg` : "SIN EXAMEN";
  console.log(`  Tema [${t.id}] orden=${t.orden} "${t.titulo}" · ${clases.length} clases · ${examTxt}`);
  if (!ev.length || Number(ev[0].preg) !== 5) problemas++;
  for (const c of clases) {
    totalClases++;
    if (!primeraUrl && c.url) primeraUrl = c.url;
    if (Number(c.html) !== 1) { console.log(`      ✗ Clase [${c.id}] "${c.titulo}" tiene ${c.html} presentaciones html (esperado 1)`); problemas++; }
  }
}
console.log(`\nTotales: ${temas.length} temas · ${totalClases} clases`);
console.log(problemas ? `⚠  ${problemas} problema(s) detectado(s)` : "✅ Estructura correcta (cada clase 1 html, cada tema 1 examen de 5 preguntas)");
if (primeraUrl) console.log(`URL de muestra (clase 1): ${primeraUrl}`);
await pool.end();
