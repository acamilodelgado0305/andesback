// src/middlewares/docenteAccess.js
import pool from "../database.js";

/**
 * Resuelve la fila de `docentes` enlazada a un usuario de auth-service dentro de
 * un negocio. El puente es `docentes.user_id` (id lógico cross-BD). Devuelve la
 * fila o null.
 */
export const getDocenteByUser = async (userId, businessId) => {
  if (!userId || !businessId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM docentes WHERE user_id = $1 AND business_id = $2 LIMIT 1;`,
    [userId, businessId]
  );
  return rows[0] || null;
};

/**
 * Guard para rutas scoped a un programa (`/programas/:id...`).
 *
 * - admin / superadmin / user: pasan sin cambios (el controlador ya filtra por
 *   business_id).
 * - docente: solo puede tocar los programas donde dicta (fila en
 *   `programa_docentes` para su docente). Si no, 403.
 *
 * Se apoya en `req.params.id` como id del programa.
 */
export const docenteProgramaGuard = async (req, res, next) => {
  if (req.user?.role !== "docente") return next();

  const businessId = req.user?.bid;
  const programaId = req.params.id;
  if (!businessId || !programaId) {
    return res.status(400).json({ message: "Solicitud inválida." });
  }

  try {
    const { rows } = await pool.query(
      `SELECT 1
         FROM programa_docentes pd
         JOIN docentes d ON d.id = pd.docente_id
        WHERE pd.programa_id = $1
          AND d.user_id     = $2
          AND pd.business_id = $3
        LIMIT 1;`,
      [programaId, req.user.id, businessId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: "No tienes acceso a este programa." });
    }
    return next();
  } catch (err) {
    console.error("Error en docenteProgramaGuard:", err);
    return res.status(500).json({ message: "Error verificando acceso al programa." });
  }
};
