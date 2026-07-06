-- ================================================================
-- MIGRACIÓN: Presentaciones de una Clase (PDF / PPTX / SVG)
-- Una clase puede tener una grabación (video) y/o presentaciones que el
-- estudiante ve en un visor 16:9 (mismo espacio que el video). 1 fila por archivo,
-- misma filosofía que modulo_pdfs. Idempotente.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS clase_presentaciones (
  id          SERIAL PRIMARY KEY,
  clase_id    INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  modulo_id   INTEGER,                 -- se copia de la clase (como en modulo_pdfs)
  business_id INTEGER,
  nombre      VARCHAR(255),            -- nombre original del archivo
  tipo        VARCHAR(10),             -- 'pdf' | 'pptx' | 'svg'
  url         TEXT,                    -- URL pública en GCS
  gcs_path    TEXT,                    -- para poder borrarlo de GCS
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clase_presentaciones_clase ON clase_presentaciones(clase_id);

COMMIT;
