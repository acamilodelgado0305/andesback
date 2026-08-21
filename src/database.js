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
      ON CONFLICT DO NOTHING;
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
    // Foto de perfil del estudiante (la sube el admin, se guarda en GCS).
    await pool.query(`
      ALTER TABLE public.students
        ADD COLUMN IF NOT EXISTS foto_url      TEXT,
        ADD COLUMN IF NOT EXISTS foto_gcs_path TEXT;
    `);
    // Intensidad horaria del programa (horas teórico-prácticas) que se imprime en
    // el diploma que se genera al graduar al estudiante.
    await pool.query(`
      ALTER TABLE public.programas
        ADD COLUMN IF NOT EXISTS intensidad_horaria integer;
    `);
    // Graduación POR PROGRAMA: cada inscripción (estudiante-programa) se gradúa de
    // forma independiente. Antes la graduación era global en students.fecha_graduacion,
    // lo que marcaba al estudiante como graduado en todos sus programas a la vez.
    await pool.query(`
      ALTER TABLE public.estudiante_programas
        ADD COLUMN IF NOT EXISTS fecha_graduacion timestamp;
    `);
    // Archivado de PROGRAMAS: un programa archivado desaparece de la lista principal
    // pero no se borra (su contenido, estudiantes e historial se conservan). Es
    // distinto de `activo`, que solo marca si el programa está abierto o no.
    await pool.query(`
      ALTER TABLE public.programas
        ADD COLUMN IF NOT EXISTS archived        boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS archived_reason text,
        ADD COLUMN IF NOT EXISTS archived_at     timestamp;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_programas_archived
        ON public.programas (business_id, archived);
    `);
    console.log("Migraciones ejecutadas correctamente.");
  } catch (err) {
    console.error("Error ejecutando migraciones:", err);
  }

  // ─── Sistema de PERIODOS (cortes) para calificaciones ────────────────────
  // Un "cierre" pasa a ser un periodo académico ordenado (Periodo 1, 2, 3).
  // El periodo ACTUAL de un programa = el de menor `orden` que no esté cerrado
  // ni sea histórico. Las notas de cada periodo son independientes: la nota de
  // una materia en el periodo N es el promedio de las evaluaciones que el
  // estudiante respondió DENTRO de ese periodo.
  //   - Programas tipo 'Curso' → 1 solo periodo (no necesitan cortes).
  //   - Técnico / Validación   → 3 periodos.
  // Ver migration_periodos_notas.sql.
  try {
    await pool.query(`
      ALTER TABLE public.cierres
        ADD COLUMN IF NOT EXISTS orden        INTEGER,
        ADD COLUMN IF NOT EXISTS es_historico BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    // El periodo en que el estudiante respondió la evaluación. Permite que el
    // promedio de la materia se calcule por periodo y no sobre todo el histórico.
    await pool.query(`
      ALTER TABLE public.evaluacion_asignaciones
        ADD COLUMN IF NOT EXISTS cierre_id INTEGER
          REFERENCES public.cierres(id) ON DELETE SET NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_eval_asignaciones_cierre
        ON public.evaluacion_asignaciones (cierre_id);
    `);
    // Orden para los cierres que ya existían (por antigüedad, dentro del programa).
    await pool.query(`
      UPDATE public.cierres c SET orden = sub.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY programa_id ORDER BY created_at) rn
        FROM public.cierres
      ) sub
      WHERE c.id = sub.id AND c.orden IS NULL;
    `);
    // Periodo histórico "Notas anteriores" (cerrado) para los programas que
    // tienen notas sin periodo asignado — se crea uno por programa.
    await pool.query(`
      INSERT INTO public.cierres (nombre, programa_id, business_id, cerrado, fecha_cierre, es_historico, orden)
      SELECT DISTINCT 'Notas anteriores', p.id, p.business_id, TRUE, NOW(), TRUE, 0
      FROM public.grades g
      JOIN public.programas p ON LOWER(TRIM(p.nombre)) = LOWER(TRIM(g.programa))
      WHERE g.cierre_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.cierres c WHERE c.programa_id = p.id AND c.es_historico
        );
    `);
    await pool.query(`
      UPDATE public.grades g SET cierre_id = c.id
      FROM public.cierres c
      JOIN public.programas p ON c.programa_id = p.id
      WHERE LOWER(TRIM(p.nombre)) = LOWER(TRIM(g.programa))
        AND c.es_historico = TRUE
        AND g.cierre_id IS NULL;
    `);
    // Segunda pasada: notas viejas cuyo texto `grades.programa` ya no coincide
    // con ningún programa (programas renombrados). El portal del estudiante las
    // resuelve por el nombre de la MATERIA, así que las anclamos por esa vía al
    // periodo histórico del programa en el que el estudiante está inscrito.
    await pool.query(`
      INSERT INTO public.cierres (nombre, programa_id, business_id, cerrado, fecha_cierre, es_historico, orden)
      SELECT DISTINCT 'Notas anteriores', p.id, p.business_id, TRUE, NOW(), TRUE, 0
      FROM public.grades g
      JOIN public.materias m ON LOWER(TRIM(m.nombre)) = LOWER(TRIM(g.materia))
      JOIN public.estudiante_programas ep
        ON ep.programa_id = m.programa_id AND ep.estudiante_id = g.student_id
      JOIN public.programas p ON p.id = m.programa_id
      WHERE g.cierre_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.cierres c WHERE c.programa_id = p.id AND c.es_historico
        );
    `);
    await pool.query(`
      UPDATE public.grades g SET cierre_id = c.id
      FROM public.materias m
      JOIN public.estudiante_programas ep ON ep.programa_id = m.programa_id
      JOIN public.cierres c ON c.programa_id = m.programa_id AND c.es_historico = TRUE
      WHERE g.cierre_id IS NULL
        AND LOWER(TRIM(m.nombre)) = LOWER(TRIM(g.materia))
        AND ep.estudiante_id = g.student_id;
    `);
    // Periodos estándar por tipo de programa. Idempotente: solo inserta el
    // orden que falte, así los periodos que el admin ya creó se respetan.
    await pool.query(`
      INSERT INTO public.cierres (nombre, programa_id, business_id, cerrado, es_historico, orden)
      SELECT
        CASE WHEN p.tipo_programa = 'Curso' THEN 'Periodo único'
             ELSE 'Periodo ' || n.orden END,
        p.id, p.business_id, FALSE, FALSE, n.orden
      FROM public.programas p
      CROSS JOIN LATERAL (
        SELECT generate_series(1, CASE WHEN p.tipo_programa = 'Curso' THEN 1 ELSE 3 END) AS orden
      ) n
      WHERE COALESCE(p.archivado, FALSE) = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM public.cierres c
          WHERE c.programa_id = p.id AND c.es_historico = FALSE AND c.orden = n.orden
        );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cierres_programa_orden
        ON public.cierres (programa_id, orden);
    `);
    console.log("Migración periodos_notas aplicada correctamente.");
  } catch (err) {
    console.error("Error en migración periodos_notas:", err);
  }

  // Acceso de docentes (login con rol propio): enlace con el usuario de
  // auth-service (docentes.user_id, id lógico cross-BD) + datos de perfil que el
  // docente completa en su primer ingreso. Ver migration_docente_acceso.sql.
  //
  // En su PROPIO try/catch a propósito: si una migración anterior falla, este
  // bloque igual debe ejecutarse (antes iba al final del try grande y se saltaba).
  try {
    await pool.query(`
      ALTER TABLE public.docentes
        ADD COLUMN IF NOT EXISTS user_id              INTEGER,
        ADD COLUMN IF NOT EXISTS telefono             TEXT,
        ADD COLUMN IF NOT EXISTS bio                  TEXT,
        ADD COLUMN IF NOT EXISTS perfil_completado_at TIMESTAMP;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_docentes_user_business
        ON public.docentes(user_id, business_id)
        WHERE user_id IS NOT NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_docentes_user_id
        ON public.docentes(user_id);
    `);
    console.log("Migración docente_acceso aplicada correctamente.");
  } catch (err) {
    console.error("Error en migración docente_acceso:", err);
  }

  // El nombre de un programa debe ser único DENTRO del negocio, no en toda la
  // base. El índice viejo (programas_nombre_idx, único global) impedía que dos
  // instituciones distintas ofrecieran "Validación de Bachillerato" — y rompe
  // el demo educativo, donde cada visitante siembra los mismos programas.
  //
  // El controlador ya asumía este comportamiento: su error 23505 dice
  // "Ya existe un programa con ese nombre en este negocio".
  //
  // Se aborta si hay duplicados (business_id, nombre) preexistentes, para no
  // dejar la migración a medias con el índice viejo ya eliminado.
  try {
    const { rows: dup } = await pool.query(`
      SELECT business_id, nombre FROM public.programas
      GROUP BY business_id, nombre HAVING COUNT(*) > 1 LIMIT 5;
    `);
    if (dup.length > 0) {
      console.warn(
        "Migración programa_nombre_por_negocio OMITIDA: hay nombres de programa repetidos dentro de un mismo negocio.",
        dup
      );
    } else {
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_programas_business_nombre
          ON public.programas (business_id, nombre);
      `);
      await pool.query(`DROP INDEX IF EXISTS public.programas_nombre_idx;`);
      console.log("Migración programa_nombre_por_negocio aplicada correctamente.");
    }
  } catch (err) {
    console.error("Error en migración programa_nombre_por_negocio:", err);
  }
};

testConnection();
runMigrations();

export default pool;