-- ============================================================================
-- Enlaces de inscripción por coordinador (varios por programa)
-- ----------------------------------------------------------------------------
-- Antes: cada programa tenía UN solo enlace (columnas programas.join_token /
-- join_coordinador_id / join_enabled). Ahora un programa puede tener VARIOS
-- enlaces, uno por coordinador, para saber a quién pertenece cada enlace y que
-- cada coordinador reciba a los estudiantes que se inscriben con el suyo.
--
-- Las columnas legacy en `programas` NO se eliminan (compatibilidad): la
-- resolución pública del token consulta primero esta tabla y, si no encuentra,
-- cae al enlace legacy.
--
-- Ejecutar manualmente en la BD (este backend no corre migraciones solo).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.programa_join_links (
  id             SERIAL PRIMARY KEY,
  programa_id    INTEGER NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  business_id    INTEGER,
  coordinador_id INTEGER NOT NULL,
  token          TEXT    NOT NULL UNIQUE,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Un coordinador tiene a lo sumo un enlace por programa.
  CONSTRAINT programa_join_links_prog_coord_uniq UNIQUE (programa_id, coordinador_id)
);

CREATE INDEX IF NOT EXISTS idx_programa_join_links_programa
  ON public.programa_join_links (programa_id);

-- Migra el enlace único existente de cada programa a la nueva tabla.
INSERT INTO public.programa_join_links (programa_id, business_id, coordinador_id, token, enabled, created_at)
SELECT id, business_id, join_coordinador_id, join_token, COALESCE(join_enabled, TRUE), NOW()
FROM public.programas
WHERE join_token IS NOT NULL AND join_coordinador_id IS NOT NULL
ON CONFLICT (token) DO NOTHING;
