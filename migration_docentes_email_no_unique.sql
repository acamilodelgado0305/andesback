-- ================================================================
-- MIGRACIÓN: quitar unicidad global del email en docentes
-- El email de un docente es información de contacto, no su identidad.
-- La restricción UNIQUE(email) era global (multi-negocio) y bloqueaba
-- crear docentes cuando el correo ya existía (p. ej. el admin que
-- también es docente). La identidad real del docente es su id (PK).
-- ================================================================

BEGIN;

ALTER TABLE docentes DROP CONSTRAINT IF EXISTS docentes_email_key;

COMMIT;
