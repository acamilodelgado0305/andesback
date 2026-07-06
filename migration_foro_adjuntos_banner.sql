-- ================================================================
-- MIGRACIÓN: Adjuntos en el foro (archivos y enlaces) + banner de materia
-- Idempotente.
-- ================================================================

BEGIN;

-- Adjuntos de una publicación del foro: archivos subidos a GCS o enlaces externos.
CREATE TABLE IF NOT EXISTS materia_foro_adjuntos (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES materia_foro_posts(id) ON DELETE CASCADE,
  business_id INTEGER,
  tipo        VARCHAR(20) NOT NULL,   -- 'archivo' | 'enlace'
  nombre      VARCHAR(255),           -- nombre original del archivo o título del enlace
  url         TEXT NOT NULL,          -- URL pública en GCS o URL del enlace
  gcs_path    TEXT,                   -- solo para 'archivo', permite borrarlo de GCS
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_foro_adjuntos_post ON materia_foro_adjuntos(post_id);

-- Banner (imagen de portada) de la materia.
ALTER TABLE materias ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE materias ADD COLUMN IF NOT EXISTS banner_gcs_path TEXT;

COMMIT;
