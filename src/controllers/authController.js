import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail } from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { z } from 'zod'; // Recomendado: validación estricta
import pool from '../database.js'; // Conexión a la base de datos

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secreto_seguro';

// Registrar usuario
const registerSchema = z.object({
  name: z.string().min(2, "El nombre es muy corto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener mínimo 6 caracteres"),
  // Opcionales por si quieres vincularlo de una vez, sino serán null/default
  business_id: z.number().optional(),
  role: z.enum(['user', 'admin', 'superadmin']).optional().default('user')
});

const registerController = async (req, res) => {
  // 1. Validación de datos de entrada (Zod)
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.errors.map(e => e.message)
    });
  }

  const { name, email, password, business_id, role } = validation.data;

  try {
    // 2. Verificar si el usuario ya existe
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
    }

    // 3. Encriptar contraseña (Bcrypt)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Insertar Usuario
    // Usamos COALESCE o valores por defecto definidos en tu SQL
    const insertQuery = `
      INSERT INTO users (name, email, password, role, business_id, app, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'pos_general', NOW(), NOW())
      RETURNING id, name, email, role, business_id
    `;

    const result = await pool.query(insertQuery, [
      name,
      email,
      hashedPassword,
      role,       // Por defecto 'user' si no se envía
      business_id || null // NULL si no se envía
    ]);

    const newUser = result.rows[0];

    // 5. Respuesta Exitosa
    // No generamos token aquí obligatoriamente, ya que el usuario quizás
    // no deba entrar hasta que tú le asignes el plan manualmente.
    res.status(201).json({
      message: 'Usuario registrado correctamente. Pendiente asignación de plan.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno del servidor al crear usuario' });
  }
};

// Lista maestra de módulos para Superadmins (acceso total)
// Asegúrate de usar las mismas claves (keys) que pusiste en RootLayout.jsx
const MASTER_MODULES = [
  'POS',
  'ACADEMICO',
  'INVENTARIO',
  'PERSONAS',
  'MOVIMIENTOS',
  'ADMIN',
  'GENERACION'
];

const getAllowedModules = async (userId, role) => {
  if (role === 'superadmin') {
    return MASTER_MODULES;
  }

  const subQuery = `
    SELECT p.modules
    FROM subscriptions s
    INNER JOIN plans p ON s.plan_id = p.id
    WHERE s.user_id = $1 
      AND s.status = 'active' 
      AND s.end_date >= CURRENT_DATE 
    ORDER BY s.end_date DESC 
    LIMIT 1
  `;

  const subResult = await pool.query(subQuery, [userId]);
  const subscription = subResult.rows[0];

  if (subscription && subscription.modules) {
    return subscription.modules;
  }

  console.log(`Usuario ${userId} se logueó sin suscripción activa.`);
  return [];
};

const getOrganizationsForUser = async (userId) => {
  const orgQuery = `
    SELECT o.id, o.name, o.nit, o.logo_url, o.address, ou.is_default
    FROM organization_users ou
    INNER JOIN organizations o ON o.id = ou.organization_id
    WHERE ou.user_id = $1
    ORDER BY ou.is_default DESC, o.id ASC
  `;

  const orgResult = await pool.query(orgQuery, [userId]);
  const organizations = orgResult.rows || [];
  const activeOrganization = organizations.length > 0 ? organizations[0] : null;

  return { organizations, activeOrganization };
};

// Iniciar sesión
const loginController = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Validar Usuario existente
    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // 2. Validar Contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // =================================================================
    // 3. NUEVA LÓGICA: Determinar Módulos Permitidos (RBAC + ABAC)
    // =================================================================
    const allowedModules = await getAllowedModules(user.id, user.role);

    // =================================================================
    // 4. Organizaciones disponibles para el usuario
    // =================================================================

    const { organizations, activeOrganization } = await getOrganizationsForUser(user.id);

    // =================================================================
    // 5. Generación del Token
    // =================================================================

    const tokenPayload = {
      sub: user.id,          // Estándar JWT para el ID del sujeto
      id: user.id,           // Redundancia útil para el front
      name: user.name,
      role: user.role,       // RBAC
      bid: user.business_id,
      scope: user.app,       // Legacy (si lo sigues usando)
      modules: allowedModules, // <--- ¡AQUÍ VIAJAN LOS PERMISOS!
      organization: activeOrganization,
      organizations
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET no definido");
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    const token = jwt.sign(tokenPayload, secret, { expiresIn: "8h" });

    // 6. Respuesta al Frontend
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        modules: allowedModules, // Enviamos los módulos también en el JSON para acceso rápido
        organization: activeOrganization,
        organizations
      },
      message: "Bienvenido al sistema",
    });

  } catch (err) {
    console.error("Error crítico en login:", err);
    res.status(500).json({ error: "Error procesando la solicitud" });
  }
};

export default loginController;



const getUserByIdController = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'El ID del usuario es requerido' });
  }

  try {
    // Seleccionamos todos los campos EXCEPTO la contraseña
    const result = await pool.query(`
      SELECT id, email, name, created_at, updated_at, app, role 
      FROM users 
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error obteniendo usuario por ID:', err);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
  }
};

const switchOrganizationSchema = z.object({
  organization_id: z.number().int()
});

const switchOrganizationController = async (req, res) => {
  const validation = switchOrganizationSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.errors.map(e => e.message)
    });
  }

  const { organization_id } = validation.data;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  try {
    const membership = await pool.query(
      'SELECT 1 FROM organization_users WHERE user_id = $1 AND organization_id = $2',
      [userId, organization_id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'No pertenece a esa organización' });
    }

    const userResult = await pool.query(
      'SELECT id, name, email, role, app, business_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const allowedModules = await getAllowedModules(user.id, user.role);
    const { organizations } = await getOrganizationsForUser(user.id);
    const activeOrganization = organizations.find(o => o.id === organization_id) || null;

    const tokenPayload = {
      sub: user.id,
      id: user.id,
      name: user.name,
      role: user.role,
      bid: user.business_id,
      scope: user.app,
      modules: allowedModules,
      organization: activeOrganization,
      organizations
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET no definido");
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    const token = jwt.sign(tokenPayload, secret, { expiresIn: "8h" });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        modules: allowedModules,
        organization: activeOrganization,
        organizations
      },
      message: "Organización seleccionada"
    });
  } catch (err) {
    console.error("Error cambiando organización:", err);
    return res.status(500).json({ error: "Error procesando la solicitud" });
  }
};

export { registerController, loginController, getUserByIdController, switchOrganizationController };
