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

    let allowedModules = [];

    // CASO A: Es SuperAdmin -> Tiene acceso a todo sin consultar suscripción
    if (user.role === 'superadmin') {
      allowedModules = MASTER_MODULES;
    }
    // CASO B: Es Usuario Normal -> Depende de su suscripción activa
    else {
      // Consultamos si tiene una suscripción 'active' y que no haya vencido hoy
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

      const subResult = await pool.query(subQuery, [user.id]);
      const subscription = subResult.rows[0];

      if (subscription && subscription.modules) {
        allowedModules = subscription.modules;
      } else {
        // Opción: Dejarlo entrar pero sin módulos (verá todo vacío y alerta de pago)
        // O bloquearlo aquí con un return res.status(403)...
        allowedModules = [];
        console.log(`Usuario ${user.email} se logueó sin suscripción activa.`);
      }
    }

    // =================================================================
    // 4. Generación del Token
    // =================================================================

    const tokenPayload = {
      sub: user.id,          // Estándar JWT para el ID del sujeto
      id: user.id,           // Redundancia útil para el front
      name: user.name,
      role: user.role,       // RBAC
      bid: user.business_id,
      scope: user.app,       // Legacy (si lo sigues usando)
      modules: allowedModules // <--- ¡AQUÍ VIAJAN LOS PERMISOS!
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET no definido");
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    const token = jwt.sign(tokenPayload, secret, { expiresIn: "8h" });

    // 5. Respuesta al Frontend
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        modules: allowedModules, // Enviamos los módulos también en el JSON para acceso rápido
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

export { registerController, loginController, getUserByIdController };
