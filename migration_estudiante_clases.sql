-- ================================================================
-- MIGRACIÓN: Progreso de un estudiante por Clase (dentro de un Tema)
-- Permite marcar cada clase como completada individualmente, para
-- habilitar el botón "Siguiente clase" en el portal del estudiante.
-- Idempotente.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS estudiante_clases (
  id                SERIAL PRIMARY KEY,
  clase_id          INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  estudiante_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  business_id       INTEGER,
  estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'completado'
  fecha_completado  TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (clase_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_estudiante_clases_estudiante ON estudiante_clases(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_estudiante_clases_clase ON estudiante_clases(clase_id);

COMMIT;
