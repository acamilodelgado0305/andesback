import pkg from "pg"; import dotenv from "dotenv"; dotenv.config();
const { Pool } = pkg;
const pool = new Pool({ host: process.env.PGHOST, database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD, port: 5432, ssl: { rejectUnauthorized: false } });
const run = async () => {
  // Todas las materias con esos nombres, cualquier negocio, con conteos y business_id de sus modulos
  const q = await pool.query(`
    SELECT m.id, m.nombre, m.business_id, m.programa_id, m.created_at,
      (SELECT COUNT(*) FROM public.modulos md WHERE md.materia_id=m.id)::int AS temas,
      (SELECT COUNT(*) FROM public.clases c JOIN public.modulos md ON md.id=c.modulo_id WHERE md.materia_id=m.id)::int AS clases,
      (SELECT COUNT(*) FROM public.evaluaciones e WHERE e.materia_id=m.id)::int AS evals_materia_id,
      (SELECT string_agg(DISTINCT md.business_id::text, ',') FROM public.modulos md WHERE md.materia_id=m.id) AS modulos_bids
    FROM public.materias m
    WHERE lower(m.nombre) LIKE '%recursos humanos%' OR lower(m.nombre) LIKE '%legislacion laboral%'
    ORDER BY m.nombre, m.created_at`);
  console.table(q.rows.map(r=>({id:r.id,nombre:(r.nombre||'').slice(0,26),bid:r.business_id,prog:r.programa_id,creada:new Date(r.created_at).toISOString().slice(5,16),temas:r.temas,clases:r.clases,evals:r.evals_materia_id,mod_bids:r.modulos_bids})));
  await pool.end();
};
run().catch(e=>{console.error(e);process.exit(1);});
