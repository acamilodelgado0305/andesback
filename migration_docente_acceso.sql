-- =============================================================================
-- Acceso de docentes (login con rol propio)
-- =============================================================================
-- Enlaza cada docente (andesback / BD controla) con su usuario de auth-service
-- (BD auth_service) mediante docentes.user_id (id lógico, sin FK cross-BD), y
-- guarda datos de perfil que el docente completa en su primer ingreso.
--
-- Idempotente. También se aplica automáticamente en runMigrations()
-- (andesback/src/database.js) al arrancar el backend.
-- =============================================================================

ALTER TABLE public.docentes
  ADD COLUMN IF NOT EXISTS user_id              INTEGER,
  ADD COLUMN IF NOT EXISTS telefono             TEXT,
  ADD COLUMN IF NOT EXISTS bio                  TEXT,
  ADD COLUMN IF NOT EXISTS perfil_completado_at TIMESTAMP;

-- Un usuario de auth-service se enlaza a lo sumo con un docente por negocio.
CREATE UNIQUE INDEX IF NOT EXISTS uq_docentes_user_business
  ON public.docentes(user_id, business_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_docentes_user_id
  ON public.docentes(user_id);
