-- ================================================================
-- MIGRACIÓN: Certificados del estudiante (PDF)
-- El admin/coordinador sube uno o varios PDFs de certificado a un
-- estudiante. El estudiante los ve en su portal, en las secciones
-- "Certificados" y "Paz y Salvo". 1 fila por archivo, mismo enfoque
-- que modulo_pdfs / clase_presentaciones. Idempotente.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS student_certificados (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  business_id  INTEGER,
  nombre       VARCHAR(255),            -- nombre original del archivo
  url          TEXT,                    -- URL pública en GCS
  gcs_path     TEXT,                    -- para poder borrarlo de GCS
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_certificados_student ON student_certificados(student_id);

COMMIT;
