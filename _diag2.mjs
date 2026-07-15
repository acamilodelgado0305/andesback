import pkg from "pg"; import dotenv from "dotenv"; dotenv.config();
const { Pool } = pkg;
const pool = new Pool({ host: process.env.PGHOST, database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD, port: 5432, ssl: { rejectUnauthorized: false } });
const run = async () => {
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='materias'`);
  const hasCreated = cols.rows.some(r => r.column_name === 'created_at');
  console.log("materias tiene created_at:", hasCreated);
  // materias más recientes con conteo de temas/clases/evals
  const q = await pool.query(`
    SELECT m.id, m.nombre, m.business_id, ${hasCreated ? 'm.created_at' : 'NULL AS created_at'},
      (SELECT COUNT(*) FROM public.modulos md WHERE md.materia_id=m.id)::int AS temas,
      (SELECT COUNT(*) FROM public.clases c JOIN public.modulos md ON md.id=c.modulo_id WHERE md.materia_id=m.id)::int AS clases,
      (SELECT COUNT(*) FROM public.evaluaciones e WHERE e.materia_id=m.id)::int AS evals
    FROM public.materias m
    ${hasCreated ? 'ORDER BY m.created_at DESC NULLS LAST' : 'ORDER BY m.id DESC'}
    LIMIT 15`);
  console.log("== 15 materias más recientes ==");
  console.table(q.rows.map(r => ({ id:r.id, nombre:(r.nombre||'').slice(0,34), bid:r.business_id, creada: r.created_at ? new Date(r.created_at).toISOString().slice(0,16):'-', temas:r.temas, clases:r.clases, evals:r.evals })));
  await pool.end();
};
run().catch(e=>{console.error(e);process.exit(1);});
