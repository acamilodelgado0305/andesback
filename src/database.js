import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

// Establece la zona horaria para que 'pg' la use en todas las conexiones.
process.env.PGTZ = process.env.PGTZ || 'UTC';

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("connect", () => {
  console.log("Conectado a la base de datos PostgreSQL.");
});

pool.on("error", (err) => {
  console.error("Error en la conexión con PostgreSQL", err);
  process.exit(-1);
});

// Función para probar la conexión y verificar la zona horaria
const testConnection = async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    // node-postgres convierte el resultado de NOW() a un objeto Date de JS
    const fechaDesdeDB = res.rows[0].now;

    console.log("Conexión exitosa y prueba de zona horaria completada.");
    console.log("========================================================");
    console.log("-> Hora en UTC (como la maneja Node):", fechaDesdeDB.toISOString());
    console.log(
      "-> HORA VERIFICADA (formato Colombia):",
      fechaDesdeDB.toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        hour12: true,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      })
    );
    console.log("========================================================");

  } catch (err) {
    console.error("Error probando la conexión con PostgreSQL", err);
  }
};

const runMigrations = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.evaluacion_programas (
        evaluacion_id int4 NOT NULL,
        programa_id   int4 NOT NULL,
        PRIMARY KEY (evaluacion_id, programa_id),
        CONSTRAINT evaluacion_programas_evaluacion_fkey
          FOREIGN KEY (evaluacion_id) REFERENCES public.evaluaciones(id) ON DELETE CASCADE,
        CONSTRAINT evaluacion_programas_programa_fkey
          FOREIGN KEY (programa_id) REFERENCES public.programas(id) ON DELETE CASCADE
      );
    `);
    await pool.query(`
      INSERT INTO public.evaluacion_programas (evaluacion_id, programa_id)
      SELECT id, programa_id FROM public.evaluaciones WHERE programa_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);
    console.log("Migraciones ejecutadas correctamente.");
  } catch (err) {
    console.error("Error ejecutando migraciones:", err);
  }
};

testConnection();
runMigrations();

export default pool;