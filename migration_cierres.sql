-- ================================================================
-- MIGRACIÓN: Sistema de Cierres para Calificaciones
-- Ejecutar en orden dentro de una transacción
-- ================================================================

BEGIN;

-- 1. Crear tabla de cierres
CREATE TABLE IF NOT EXISTS cierres (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    programa_id INTEGER NOT NULL REFERENCES programas(id) ON DELETE CASCADE,
    business_id INTEGER,
    cerrado     BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_cierre TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agregar cierre_id a grades (nullable para la migración)
ALTER TABLE grades ADD COLUMN IF NOT EXISTS cierre_id INTEGER REFERENCES cierres(id) ON DELETE CASCADE;

-- 3. Crear cierre "Notas Anteriores" por cada programa que tenga notas sin cierre asignado
INSERT INTO cierres (nombre, programa_id, cerrado, fecha_cierre, business_id)
SELECT DISTINCT
    'Notas Anteriores',
    p.id,
    true,
    NOW(),
    p.business_id
FROM grades g
JOIN programas p ON LOWER(TRIM(p.nombre)) = LOWER(TRIM(g.programa))
WHERE g.cierre_id IS NULL
ON CONFLICT DO NOTHING;

-- 4. Asignar las notas existentes a su cierre "Notas Anteriores"
UPDATE grades g
SET cierre_id = c.id
FROM cierres c
JOIN programas p ON c.programa_id = p.id
WHERE LOWER(TRIM(p.nombre)) = LOWER(TRIM(g.programa))
  AND c.nombre = 'Notas Anteriores'
  AND g.cierre_id IS NULL;

-- 5. Eliminar PK y unique constraint anteriores
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_pkey;
ALTER TABLE grades DROP CONSTRAINT IF EXISTS unique_student_materia;

-- 6. Agregar id serial como nueva clave primaria
ALTER TABLE grades ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE grades ADD CONSTRAINT grades_pkey PRIMARY KEY (id);

-- 7. Nueva restricción única: un estudiante tiene una nota por materia por cierre
ALTER TABLE grades ADD CONSTRAINT grades_student_materia_cierre_uq
    UNIQUE (student_id, materia, cierre_id);

COMMIT;
