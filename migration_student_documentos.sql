-- =============================================================================
-- Documentos que el ESTUDIANTE sube desde su propio portal (Mis Documentos).
-- Son distintos de student_certificados (esos los emite la institución).
-- Esta migración también se ejecuta sola en runMigrations() (src/database.js);
-- este archivo queda para poder aplicarla a mano en producción.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.student_documentos (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  business_id  INTEGER,
  nombre       VARCHAR(255),
  tipo         VARCHAR(60),
  url          TEXT,
  gcs_path     TEXT,
  subido_por   VARCHAR(20) NOT NULL DEFAULT 'estudiante',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_documentos_student
  ON public.student_documentos(student_id);
