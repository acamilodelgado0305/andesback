-- ================================================================
-- MIGRACIÓN: Comentarios de la clase (discusión por clase)
-- Hilo de comentarios dentro de una clase, donde participan admin,
-- docentes y estudiantes (todos ven y escriben). Soporta respuestas
-- anidadas vía parent_id, igual que el foro de la materia.
-- Idempotente.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS clase_comentarios (
  id           SERIAL PRIMARY KEY,
  clase_id     INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  business_id  INTEGER,
  parent_id    INTEGER REFERENCES clase_comentarios(id) ON DELETE CASCADE, -- respuesta a otro comentario
  autor_tipo   VARCHAR(20) NOT NULL,   -- 'admin' | 'docente' | 'estudiante'
  autor_id     INTEGER,                -- id de user (admin/docente) o de estudiante
  autor_nombre VARCHAR(255),
  contenido    TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clase_coment_clase  ON clase_comentarios(clase_id);
CREATE INDEX IF NOT EXISTS idx_clase_coment_parent ON clase_comentarios(parent_id);

COMMIT;
