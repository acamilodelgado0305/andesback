import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail } from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool from '../database.js'; // Conexión a la base de datos

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secreto_seguro';

// Registrar usuario
const registerController = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      error: 'Email, contraseña y nombre son requeridos'
    });
  }

  try {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const user = await createUser(email, password, name);
    res.status(201).json(user);
  } catch (err) {
    console.error('Error registrando usuario', err);
    res.status(500).json({ error: 'Error registrando usuario' });
  }
};

// Iniciar sesión
const loginController = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscamos el usuario (incluyendo campos vitales para el token)
    const user = await getUserByEmail(email);

    // 2. Seguridad: Mensaje genérico para evitar enumeración de usuarios
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // 3. Verificación de contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // 4. Construcción del Payload Enriquecido (La clave de la mejora)
    // Usamos datos extraídos directamente de tu esquema SQL
    const tokenPayload = {
      sub: user.id,            // Standard Subject ID
      name: user.name,         // Para UX
      role: user.role,         // Para permisos (admin/user)
      bid: user.business_id,   // Para filtrar datos de la empresa
      scope: user.app          // Para contexto de la aplicación
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' }); // 8h jornada laboral

    // 5. Respuesta limpia: Token + Datos de usuario (sin password)
    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role
      },
      message: 'Bienvenido al sistema'
    });

  } catch (err) {
    console.error('Error crítico en login:', err); // Log interno detallado
    res.status(500).json({ error: 'Error procesando la solicitud' }); // Mensaje seguro al cliente
  }
};


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
