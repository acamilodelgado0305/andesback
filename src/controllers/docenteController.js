import pool from '../database.js';

// Datos del docente que se devuelven al enlazar con su perfil (sin exponer
// columnas internas innecesarias). Nota: la foto NO vive aquí sino en
// auth-service (users.avatar_url); el frontend la carga vía GET /api/users/me.
const DOCENTE_PROFILE_COLS =
  'id, nombre_completo, email, especialidad, telefono, bio, user_id, perfil_completado_at';

// --- CREATE ---
export const createDocente = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) {
    return res.status(400).json({ message: 'Token sin business asociado.' });
  }

  const { nombre_completo, email, especialidad } = req.body;
  if (!nombre_completo || !email) {
    return res.status(400).json({ message: 'El nombre completo y el email son obligatorios.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO docentes (nombre_completo, email, especialidad, business_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [nombre_completo, email, especialidad || null, businessId]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: `El email '${email}' ya existe en este negocio.` });
    }
    console.error('Error al crear docente:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ALL) ---
export const getAllDocentes = async (req, res) => {
  const businessId = req.user?.bid;
  if (!businessId) {
    return res.status(400).json({ message: 'Token sin business asociado.' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM docentes WHERE business_id = $1 ORDER BY nombre_completo ASC;`,
      [businessId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener docentes:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- READ (ONE) ---
export const getDocenteById = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM docentes WHERE id = $1 AND business_id = $2;`,
      [id, businessId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- UPDATE ---
export const updateDocente = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { nombre_completo, email, especialidad } = req.body;

  if (!nombre_completo || !email) {
    return res.status(400).json({ message: 'El nombre completo y el email son obligatorios.' });
  }

  try {
    const result = await pool.query(
      `UPDATE docentes
       SET nombre_completo = $1,
           email           = $2,
           especialidad    = $3,
           updated_at      = CURRENT_TIMESTAMP
       WHERE id = $4 AND business_id = $5
       RETURNING *;`,
      [nombre_completo, email, especialidad || null, id, businessId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: `El email '${email}' ya está en uso por otro docente.` });
    }
    console.error(`Error al actualizar docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- DELETE ---
export const deleteDocente = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM docentes WHERE id = $1 AND business_id = $2;`,
      [id, businessId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error(`Error al eliminar docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// =============================================================================
// PERFIL PROPIO DEL DOCENTE (rol 'docente')
// =============================================================================
// El docente es un usuario real de auth-service (req.user.id = users.id) con rol
// 'docente'. Su fila de `docentes` se resuelve por user_id + business_id.

// Programas donde dicta un docente (por su fila de docentes).
const fetchProgramasDeDocente = async (docenteId, businessId) => {
  const { rows } = await pool.query(
    `SELECT p.*,
            (SELECT COUNT(*)
               FROM estudiante_programas ep
               JOIN students s ON s.id = ep.estudiante_id
              WHERE ep.programa_id = p.id
                AND (s.archived = FALSE OR s.archived IS NULL)
            )::int AS total_estudiantes
       FROM programa_docentes pd
       JOIN programas p ON p.id = pd.programa_id
      WHERE pd.docente_id = $1 AND pd.business_id = $2
      ORDER BY p.nombre ASC;`,
    [docenteId, businessId]
  );
  return rows;
};

// --- GET /api/docentes/me → perfil del docente autenticado + sus programas ---
export const getMyDocenteProfile = async (req, res) => {
  const businessId = req.user?.bid;
  const userId = req.user?.id;
  if (!businessId || !userId) {
    return res.status(400).json({ message: 'Token sin business o usuario asociado.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT ${DOCENTE_PROFILE_COLS} FROM docentes
       WHERE user_id = $1 AND business_id = $2 LIMIT 1;`,
      [userId, businessId]
    );
    if (rows.length === 0) {
      // El usuario tiene rol docente pero no hay fila de docentes enlazada.
      return res.status(404).json({ message: 'No se encontró un perfil de docente para este usuario.' });
    }

    const docente = rows[0];
    const programas = await fetchProgramasDeDocente(docente.id, businessId);

    return res.status(200).json({
      ...docente,
      perfil_completo: !!docente.perfil_completado_at,
      programas,
    });
  } catch (error) {
    console.error('Error en getMyDocenteProfile:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- PUT /api/docentes/me → el docente completa/actualiza su propio perfil ---
export const updateMyDocenteProfile = async (req, res) => {
  const businessId = req.user?.bid;
  const userId = req.user?.id;
  if (!businessId || !userId) {
    return res.status(400).json({ message: 'Token sin business o usuario asociado.' });
  }

  const { nombre_completo, telefono, especialidad, bio } = req.body;
  if (!nombre_completo || !nombre_completo.trim()) {
    return res.status(400).json({ message: 'El nombre completo es obligatorio.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE docentes
          SET nombre_completo      = $1,
              telefono             = $2,
              especialidad         = $3,
              bio                  = $4,
              perfil_completado_at = COALESCE(perfil_completado_at, CURRENT_TIMESTAMP),
              updated_at           = CURRENT_TIMESTAMP
        WHERE user_id = $5 AND business_id = $6
        RETURNING ${DOCENTE_PROFILE_COLS};`,
      [nombre_completo.trim(), telefono || null, especialidad || null, bio || null, userId, businessId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No se encontró un perfil de docente para este usuario.' });
    }
    return res.status(200).json({ ...rows[0], perfil_completo: true });
  } catch (error) {
    console.error('Error en updateMyDocenteProfile:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- GET /api/docentes/me/programas → programas donde dicta el docente ---
export const getMyProgramas = async (req, res) => {
  const businessId = req.user?.bid;
  const userId = req.user?.id;
  if (!businessId || !userId) {
    return res.status(400).json({ message: 'Token sin business o usuario asociado.' });
  }

  try {
    const { rows: docRows } = await pool.query(
      `SELECT id FROM docentes WHERE user_id = $1 AND business_id = $2 LIMIT 1;`,
      [userId, businessId]
    );
    if (docRows.length === 0) {
      return res.status(404).json({ message: 'No se encontró un perfil de docente para este usuario.' });
    }
    const programas = await fetchProgramasDeDocente(docRows[0].id, businessId);
    return res.status(200).json(programas);
  } catch (error) {
    console.error('Error en getMyProgramas:', error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// =============================================================================
// ENLACE DE ACCESO (lo gestiona el admin)
// =============================================================================
// El admin ya creó el usuario del docente en auth-service (rol 'docente') y
// aquí guarda ese userId en la fila de docentes para poder resolver el perfil
// cuando el docente inicie sesión.

// --- PUT /api/docentes/:id/acceso  body: { user_id } ---
export const setDocenteAcceso = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;
  const { user_id } = req.body;

  if (!businessId) {
    return res.status(400).json({ message: 'Token sin business asociado.' });
  }
  if (!user_id) {
    return res.status(400).json({ message: 'El campo "user_id" es obligatorio.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE docentes
          SET user_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND business_id = $3
        RETURNING ${DOCENTE_PROFILE_COLS};`,
      [user_id, id, businessId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    return res.status(200).json({ message: 'Acceso vinculado correctamente.', data: rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ese usuario ya está vinculado a otro docente en este negocio.' });
    }
    console.error(`Error al vincular acceso del docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// --- DELETE /api/docentes/:id/acceso → desvincula el usuario (revoca acceso) ---
export const removeDocenteAcceso = async (req, res) => {
  const businessId = req.user?.bid;
  const { id } = req.params;

  if (!businessId) {
    return res.status(400).json({ message: 'Token sin business asociado.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE docentes
          SET user_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND business_id = $2
        RETURNING id, user_id;`,
      [id, businessId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: `Docente con ID ${id} no encontrado.` });
    }
    return res.status(200).json({ message: 'Acceso revocado correctamente.' });
  } catch (error) {
    console.error(`Error al revocar acceso del docente ${id}:`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
