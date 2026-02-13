import { z } from 'zod';
import bcrypt from 'bcryptjs';
import pool from '../database.js';

// ============================================================
// SCHEMAS DE VALIDACIÓN (Zod)
// ============================================================

const createUserInOrgSchema = z.object({
    name: z.string().min(2, 'El nombre es muy corto'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener mínimo 6 caracteres'),
    role: z.enum(['user', 'admin', 'superadmin']).optional().default('user'),
    is_default: z.boolean().optional().default(false),
});

// ============================================================
// HELPERS
// ============================================================

/**
 * Verifica que el usuario autenticado pertenece a la organización
 * y (opcionalmente) que tenga un rol con permisos de administración.
 */
const verifyOrgMembership = async (userId, organizationId) => {
    const query = `
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = $1 AND ou.organization_id = $2
  `;
    const result = await pool.query(query, [userId, organizationId]);

    if (result.rows.length === 0) {
        return { isMember: false };
    }

    return { isMember: true };
};

// ============================================================
// CONTROLADORES
// ============================================================

/**
 * POST /api/organizations/:organizationId/users
 * Crea un nuevo usuario y lo asocia a la organización indicada.
 *
 * Requiere autenticación (authMiddleware).
 * El usuario autenticado debe pertenecer a la organización.
 *
 * Body esperado:
 *  - name: string
 *  - email: string
 *  - password: string
 *  - role: 'user' | 'admin' | 'superadmin' (opcional, default 'user')
 *  - is_default: boolean (opcional, default false)
 */
const createUserInOrganization = async (req, res) => {
    // 1. Obtener y validar el ID de la organización
    const organizationId = parseInt(req.params.organizationId, 10);
    if (isNaN(organizationId)) {
        return res.status(400).json({ error: 'El ID de la organización es inválido' });
    }

    // 2. Verificar que el usuario autenticado está en la organización
    const authUserId = req.user?.id;
    if (!authUserId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // 3. Validar cuerpo de la petición
    const validation = createUserInOrgSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            error: 'Datos inválidos',
            details: validation.error.errors.map(e => e.message),
        });
    }

    const { name, email, password, role, is_default } = validation.data;

    try {
        // 4. Verificar que la organización existe
        const orgCheck = await pool.query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
        if (orgCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }

        // 5. Verificar que el usuario autenticado pertenece a la organización
        const { isMember } = await verifyOrgMembership(authUserId, organizationId);
        if (!isMember) {
            return res.status(403).json({ error: 'No tienes permisos en esta organización' });
        }

        // 6. Verificar si ya existe un usuario con ese correo
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        let userId;

        if (userCheck.rows.length > 0) {
            // El usuario ya existe → solo lo asociamos a la organización
            userId = userCheck.rows[0].id;

            // Verificar que no esté ya asociado a esta organización
            const linkCheck = await pool.query(
                'SELECT 1 FROM organization_users WHERE user_id = $1 AND organization_id = $2',
                [userId, organizationId]
            );
            if (linkCheck.rows.length > 0) {
                return res.status(409).json({ error: 'El usuario ya pertenece a esta organización' });
            }
        } else {
            // 7. Crear el nuevo usuario
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const insertUserQuery = `
        INSERT INTO users (name, email, password, role, app, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'pos_general', NOW(), NOW())
        RETURNING id, name, email, role
      `;
            const newUser = await pool.query(insertUserQuery, [name, email, hashedPassword, role]);
            userId = newUser.rows[0].id;
        }

        // 8. Crear la relación usuario ↔ organización
        const insertRelQuery = `
      INSERT INTO organization_users (user_id, organization_id, is_default)
      VALUES ($1, $2, $3)
      RETURNING user_id, organization_id, is_default
    `;
        await pool.query(insertRelQuery, [userId, organizationId, is_default]);

        // 9. Devolver el usuario creado/asociado con los datos de la organización
        const userResult = await pool.query(
            `SELECT id, name, email, role, created_at FROM users WHERE id = $1`,
            [userId]
        );

        return res.status(201).json({
            message: 'Usuario creado y asociado a la organización correctamente',
            user: userResult.rows[0],
            organization_id: organizationId,
        });
    } catch (err) {
        console.error('Error creando usuario en organización:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * GET /api/organizations/:organizationId/users
 * Obtiene todos los usuarios que pertenecen a una organización.
 *
 * Requiere autenticación (authMiddleware).
 * El usuario autenticado debe pertenecer a la organización.
 *
 * Query params opcionales:
 *  - page: número de página (default 1)
 *  - limit: cantidad por página (default 50)
 *  - search: búsqueda por nombre o email
 */
const getUsersByOrganization = async (req, res) => {
    const organizationId = parseInt(req.params.organizationId, 10);
    if (isNaN(organizationId)) {
        return res.status(400).json({ error: 'El ID de la organización es inválido' });
    }

    const authUserId = req.user?.id;
    if (!authUserId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    try {
        // 1. Verificar que la organización existe
        const orgCheck = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [organizationId]);
        if (orgCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Organización no encontrada' });
        }

        // 2. Verificar que el usuario autenticado pertenece a la organización
        const { isMember } = await verifyOrgMembership(authUserId, organizationId);
        if (!isMember) {
            return res.status(403).json({ error: 'No tienes permisos en esta organización' });
        }

        // 3. Parámetros de paginación y búsqueda
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const offset = (page - 1) * limit;
        const search = req.query.search?.trim() || '';

        // 4. Construir query
        let usersQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        u.updated_at,
        ou.is_default
      FROM organization_users ou
      INNER JOIN users u ON u.id = ou.user_id
      WHERE ou.organization_id = $1
    `;
        const params = [organizationId];

        if (search) {
            params.push(`%${search}%`);
            usersQuery += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
        }

        // Query de conteo
        const countQuery = `SELECT COUNT(*) FROM (${usersQuery}) AS total`;
        const countResult = await pool.query(countQuery, params);
        const totalUsers = parseInt(countResult.rows[0].count, 10);

        // Agregar paginación
        usersQuery += ` ORDER BY u.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const usersResult = await pool.query(usersQuery, params);

        return res.json({
            organization: orgCheck.rows[0],
            users: usersResult.rows,
            pagination: {
                page,
                limit,
                total: totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
            },
        });
    } catch (err) {
        console.error('Error obteniendo usuarios de la organización:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * DELETE /api/organizations/:organizationId/users/:userId
 * Remueve un usuario de una organización (no borra el usuario, solo la relación).
 *
 * Requiere autenticación (authMiddleware).
 * El usuario autenticado debe pertenecer a la organización.
 */
const removeUserFromOrganization = async (req, res) => {
    const organizationId = parseInt(req.params.organizationId, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(organizationId) || isNaN(targetUserId)) {
        return res.status(400).json({ error: 'IDs inválidos' });
    }

    const authUserId = req.user?.id;
    if (!authUserId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    try {
        // 1. Verificar que el usuario autenticado pertenece a la organización
        const { isMember } = await verifyOrgMembership(authUserId, organizationId);
        if (!isMember) {
            return res.status(403).json({ error: 'No tienes permisos en esta organización' });
        }

        // 2. No se puede remover a uno mismo
        if (authUserId === targetUserId) {
            return res.status(400).json({ error: 'No puedes removerte a ti mismo de la organización' });
        }

        // 3. Eliminar la relación
        const deleteResult = await pool.query(
            'DELETE FROM organization_users WHERE user_id = $1 AND organization_id = $2 RETURNING user_id',
            [targetUserId, organizationId]
        );

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'El usuario no pertenece a esta organización' });
        }

        return res.json({ message: 'Usuario removido de la organización correctamente' });
    } catch (err) {
        console.error('Error removiendo usuario de la organización:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export {
    createUserInOrganization,
    getUsersByOrganization,
    removeUserFromOrganization,
};
