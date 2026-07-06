-- ================================================================
-- MIGRACIÓN: Clases dentro de un Tema (módulo)
-- El "Tema" pasa a ser solo un contenedor/agrupador; el contenido real
-- (grabación corta + descripción) vive en sus "Clases" (Clase 1, Clase 2...).
-- Idempotente.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS clases (
  id             SERIAL PRIMARY KEY,
  modulo_id      INTEGER NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
  business_id    INTEGER,
  titulo         VARCHAR(255) NOT NULL,
  descripcion    TEXT,
  video_url      TEXT,          -- enlace externo (YouTube/Vimeo/Loom/Drive) o URL pública en GCS
  video_gcs_path TEXT,          -- solo si el video se subió como archivo; permite borrarlo de GCS
  orden          INTEGER NOT NULL DEFAULT 0,
  activa         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clases_modulo ON clases(modulo_id);

-- Los PDFs ahora se adjuntan a la clase (no ya directamente al tema).
ALTER TABLE modulo_pdfs ADD COLUMN IF NOT EXISTS clase_id INTEGER REFERENCES clases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_modulo_pdfs_clase ON modulo_pdfs(clase_id);

-- Migrar temas existentes: cada tema se convierte en su propia "Clase 1"
-- para no perder la información (descripción/contenido) que ya tenía.
INSERT INTO clases (modulo_id, business_id, titulo, descripcion, orden, activa)
SELECT m.id, m.business_id, 'Clase 1', m.contenido, 0, true
FROM modulos m
WHERE NOT EXISTS (SELECT 1 FROM clases c WHERE c.modulo_id = m.id);

-- Repuntar los PDFs que ya tenía cada tema a su nueva "Clase 1"
UPDATE modulo_pdfs mp
SET clase_id = c.id
FROM clases c
WHERE c.modulo_id = mp.modulo_id AND mp.clase_id IS NULL;

COMMIT;
