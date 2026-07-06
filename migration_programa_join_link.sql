-- Enlace de inscripción por programa (estilo "unirse" de Classroom).
-- Ejecutar manualmente contra la BD (este backend no tiene migraciones automáticas).

ALTER TABLE programas
  ADD COLUMN IF NOT EXISTS join_token VARCHAR(32) UNIQUE,
  ADD COLUMN IF NOT EXISTS join_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS join_coordinador_id INTEGER;
