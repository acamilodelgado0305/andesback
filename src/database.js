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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.student_comments (
        id           SERIAL PRIMARY KEY,
        student_id   int4 NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
        business_id  int4,
        user_id      int4,
        autor_nombre varchar(255),
        comentario   text NOT NULL,
        created_at   timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at   timestamp DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_student_comments_student
        ON public.student_comments (student_id);
    `);
    await pool.query(`
      ALTER TABLE public.estudiante_programas
        ADD COLUMN IF NOT EXISTS monto_total_personalizado numeric;
    `);
    await pool.query(`
      ALTER TABLE public.programas
        ADD COLUMN IF NOT EXISTS join_token varchar(20) UNIQUE,
        ADD COLUMN IF NOT EXISTS join_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS join_coordinador_id int4;
    `);
    // Presentaciones de una clase (PDF/PPTX/SVG) para el visor 16:9. 1 fila por
    // archivo, misma filosofía que modulo_pdfs. Ver migration_clase_presentaciones.sql.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.clase_presentaciones (
        id          SERIAL PRIMARY KEY,
        clase_id    INTEGER NOT NULL REFERENCES public.clases(id) ON DELETE CASCADE,
        modulo_id   INTEGER,
        business_id INTEGER,
        nombre      VARCHAR(255),
        tipo        VARCHAR(10),
        url         TEXT,
        gcs_path    TEXT,
        orden       INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_clase_presentaciones_clase
        ON public.clase_presentaciones(clase_id);
    `);
    // Enlaces de inscripción por coordinador (varios por programa). Reemplaza el
    // enlace único legacy en programas.join_token. Ver migration_programa_join_links.sql.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.programa_join_links (
        id             SERIAL PRIMARY KEY,
        programa_id    INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
        business_id    INTEGER,
        coordinador_id INTEGER NOT NULL,
        token          TEXT    NOT NULL UNIQUE,
        enabled        BOOLEAN NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT programa_join_links_prog_coord_uniq UNIQUE (programa_id, coordinador_id)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_programa_join_links_programa
        ON public.programa_join_links (programa_id);
    `);
    await pool.query(`
      INSERT INTO public.programa_join_links (programa_id, business_id, coordinador_id, token, enabled, created_at)
      SELECT id, business_id, join_coordinador_id, join_token, COALESCE(join_enabled, TRUE), NOW()
      FROM public.programas
      WHERE join_token IS NOT NULL AND join_coordinador_id IS NOT NULL
      ON CONFLICT (token) DO NOTHING;
    `);
    // Certificados (PDF) que el admin sube a un estudiante y este ve en su portal
    // (secciones Certificados y Paz y Salvo). 1 fila por archivo, se guarda en GCS.
    // Ver migration_student_certificados.sql.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.student_certificados (
        id           SERIAL PRIMARY KEY,
        student_id   INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
        business_id  INTEGER,
        nombre       VARCHAR(255),
        url          TEXT,
        gcs_path     TEXT,
        created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_student_certificados_student
        ON public.student_certificados(student_id);
    `);
    console.log("Migraciones ejecutadas correctamente.");
  } catch (err) {
    console.error("Error ejecutando migraciones:", err);
  }
};

testConnection();
runMigrations();

export default pool;