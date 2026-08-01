-- ================================================================
-- MIGRACIÓN: Sistema de PERIODOS (cortes) para calificaciones
--
-- Ya se ejecuta AUTOMÁTICAMENTE en src/database.js (runMigrations).
-- Este archivo queda como referencia / para correrla a mano.
--
-- Modelo:
--   - Un "cierre" es un periodo académico ORDENADO (Periodo 1, 2, 3).
--   - El periodo ACTUAL de un programa = el de menor `orden` que no esté
--     cerrado ni sea histórico. Al cerrar el Periodo 1, el 2 pasa a ser actual.
--   - Los periodos son INDEPENDIENTES: la nota de una materia en el periodo N
--     es el promedio de las evaluaciones respondidas DENTRO de ese periodo.
--   - Nota final acumulada = promedio simple de los periodos no históricos.
--   - Programas tipo 'Curso' → 1 solo periodo. Técnico/Validación → 3.
-- ================================================================

BEGIN;

-- 1. Periodos ordenados + marca de periodo histórico
ALTER TABLE public.cierres
  ADD COLUMN IF NOT EXISTS orden        INTEGER,
  ADD COLUMN IF NOT EXISTS es_historico BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Periodo en que el estudiante respondió cada evaluación
ALTER TABLE public.evaluacion_asignaciones
  ADD COLUMN IF NOT EXISTS cierre_id INTEGER
    REFERENCES public.cierres(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eval_asignaciones_cierre
  ON public.evaluacion_asignaciones (cierre_id);

-- 3. Orden para los cierres que ya existían (por antigüedad dentro del programa)
UPDATE public.cierres c SET orden = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY programa_id ORDER BY created_at) rn
  FROM public.cierres
) sub
WHERE c.id = sub.id AND c.orden IS NULL;

-- 4. Periodo histórico "Notas anteriores" para programas con notas sin periodo
INSERT INTO public.cierres (nombre, programa_id, business_id, cerrado, fecha_cierre, es_historico, orden)
SELECT DISTINCT 'Notas anteriores', p.id, p.business_id, TRUE, NOW(), TRUE, 0
FROM public.grades g
JOIN public.programas p ON LOWER(TRIM(p.nombre)) = LOWER(TRIM(g.programa))
WHERE g.cierre_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cierres c WHERE c.programa_id = p.id AND c.es_historico
  );

UPDATE public.grades g SET cierre_id = c.id
FROM public.cierres c
JOIN public.programas p ON c.programa_id = p.id
WHERE LOWER(TRIM(p.nombre)) = LOWER(TRIM(g.programa))
  AND c.es_historico = TRUE
  AND g.cierre_id IS NULL;

-- 5. Segunda pasada: notas cuyo texto `grades.programa` ya no coincide con
--    ningún programa (programas renombrados). El portal las resuelve por el
--    nombre de la MATERIA, así que se anclan por esa vía.
INSERT INTO public.cierres (nombre, programa_id, business_id, cerrado, fecha_cierre, es_historico, orden)
SELECT DISTINCT 'Notas anteriores', p.id, p.business_id, TRUE, NOW(), TRUE, 0
FROM public.grades g
JOIN public.materias m ON LOWER(TRIM(m.nombre)) = LOWER(TRIM(g.materia))
JOIN public.estudiante_programas ep
  ON ep.programa_id = m.programa_id AND ep.estudiante_id = g.student_id
JOIN public.programas p ON p.id = m.programa_id
WHERE g.cierre_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cierres c WHERE c.programa_id = p.id AND c.es_historico
  );

UPDATE public.grades g SET cierre_id = c.id
FROM public.materias m
JOIN public.estudiante_programas ep ON ep.programa_id = m.programa_id
JOIN public.cierres c ON c.programa_id = m.programa_id AND c.es_historico = TRUE
WHERE g.cierre_id IS NULL
  AND LOWER(TRIM(m.nombre)) = LOWER(TRIM(g.materia))
  AND ep.estudiante_id = g.student_id;

-- 6. Periodos estándar por tipo de programa (idempotente: solo el orden faltante)
INSERT INTO public.cierres (nombre, programa_id, business_id, cerrado, es_historico, orden)
SELECT
  CASE WHEN p.tipo_programa = 'Curso' THEN 'Periodo único'
       ELSE 'Periodo ' || n.orden END,
  p.id, p.business_id, FALSE, FALSE, n.orden
FROM public.programas p
CROSS JOIN LATERAL (
  SELECT generate_series(1, CASE WHEN p.tipo_programa = 'Curso' THEN 1 ELSE 3 END) AS orden
) n
WHERE COALESCE(p.archivado, FALSE) = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM public.cierres c
    WHERE c.programa_id = p.id AND c.es_historico = FALSE AND c.orden = n.orden
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_cierres_programa_orden
  ON public.cierres (programa_id, orden);

COMMIT;

-- ================================================================
-- VERIFICACIÓN (todas deben dar 0)
-- ================================================================
-- Notas visibles al estudiante sin periodo:
--   SELECT COUNT(*) FROM grades g
--   JOIN materias m ON LOWER(TRIM(g.materia))=LOWER(TRIM(m.nombre))
--   JOIN estudiante_programas ep ON m.programa_id=ep.programa_id AND ep.estudiante_id=g.student_id
--   WHERE g.cierre_id IS NULL AND m.activa=true;
--
-- Programas activos sin periodo actual:
--   SELECT COUNT(*) FROM programas p WHERE COALESCE(p.archivado,false)=false
--   AND NOT EXISTS (SELECT 1 FROM cierres c WHERE c.programa_id=p.id AND c.cerrado=false AND c.es_historico=false);
