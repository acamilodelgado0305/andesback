// Migración manual: acceso de docentes (login con rol propio).
//
// Aplica las columnas nuevas de `docentes` (user_id, telefono, bio,
// perfil_completado_at) + índices. Idempotente. Úsalo si el arranque de
// andesback no las aplicó (runMigrations es best-effort).
//
//   node src/scripts/migrate_docente_acceso.js
//
// Usa un Pool propio (no importa database.js) para no disparar runMigrations
// y poder salir limpio.
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

const run = async () => {
  try {
    console.log(`Conectando a ${process.env.PGDATABASE} en ${process.env.PGHOST}...`);

    await pool.query(`
      ALTER TABLE public.docentes
        ADD COLUMN IF NOT EXISTS user_id              INTEGER,
        ADD COLUMN IF NOT EXISTS telefono             TEXT,
        ADD COLUMN IF NOT EXISTS bio                  TEXT,
        ADD COLUMN IF NOT EXISTS perfil_completado_at TIMESTAMP;
    `);
    console.log("✅ Columnas de docentes agregadas (user_id, telefono, bio, perfil_completado_at).");

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_docentes_user_business
        ON public.docentes(user_id, business_id)
        WHERE user_id IS NOT NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_docentes_user_id
        ON public.docentes(user_id);
    `);
    console.log("✅ Índices creados.");

    // Verificación
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'docentes'
         AND column_name IN ('user_id','telefono','bio','perfil_completado_at')
       ORDER BY column_name;
    `);
    console.log("Columnas presentes:", rows.map((r) => r.column_name).join(", "));
    console.log("🎉 Migración docente_acceso completada.");
  } catch (err) {
    console.error("❌ Error aplicando la migración:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
