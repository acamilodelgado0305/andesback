-- ================================================================
-- MIGRACIÓN: Foro de la materia (estilo aula Teams)
-- Comentarios/hilos por materia, donde participan admin, docentes y
-- estudiantes. Los "Temas" reutilizan la tabla `modulos` existente,
-- por eso aquí solo se crea la tabla del foro.
-- Idempotente.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS materia_foro_posts (
  id           SERIAL PRIMARY KEY,
  materia_id   INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
  business_id  INTEGER,
  parent_id    INTEGER REFERENCES materia_foro_posts(id) ON DELETE CASCADE, -- respuesta a otro post
  autor_tipo   VARCHAR(20) NOT NULL,   -- 'admin' | 'docente' | 'estudiante'
  autor_id     INTEGER,                -- id de user (admin/docente) o de estudiante
  autor_nombre VARCHAR(255),
  contenido    TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_foro_materia ON materia_foro_posts(materia_id);
CREATE INDEX IF NOT EXISTS idx_foro_parent  ON materia_foro_posts(parent_id);

COMMIT;
