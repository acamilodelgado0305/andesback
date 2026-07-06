-- ================================================================
-- MIGRACIÓN: Asociación directa Docentes ↔ Programas (muchos a muchos)
-- Permite asignar docentes a un programa específico, de forma
-- independiente a las materias.
-- Ejecutar dentro de una transacción.
-- ================================================================

BEGIN;

-- Tabla intermedia: un docente puede pertenecer a varios programas
-- y un programa puede tener varios docentes.
CREATE TABLE IF NOT EXISTS programa_docentes (
    id          SERIAL PRIMARY KEY,
    programa_id INTEGER NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
    docente_id  INTEGER NOT NULL REFERENCES docentes(id)  ON DELETE CASCADE,
    business_id INTEGER,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Un docente no puede estar asociado dos veces al mismo programa
    CONSTRAINT programa_docentes_uq UNIQUE (programa_id, docente_id)
);

-- Índices para los filtros más usados
CREATE INDEX IF NOT EXISTS idx_programa_docentes_programa ON programa_docentes(programa_id);
CREATE INDEX IF NOT EXISTS idx_programa_docentes_docente  ON programa_docentes(docente_id);

-- Backfill (opcional): asocia automáticamente al programa los docentes
-- que ya están asignados a alguna de sus materias, para no perder la
-- relación implícita que existía antes.
INSERT INTO programa_docentes (programa_id, docente_id, business_id)
SELECT DISTINCT m.programa_id, m.docente_id, m.business_id
FROM materias m
WHERE m.docente_id IS NOT NULL
  AND m.programa_id IS NOT NULL
ON CONFLICT (programa_id, docente_id) DO NOTHING;

COMMIT;
