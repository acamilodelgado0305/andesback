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
    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const tokenPayload = {
      sub: user.id,
      name: user.name,
      role: user.role,
      bid: user.business_id,
      scope: user.app,
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET no está definido en las variables de entorno (loginController)");
      return res.status(500).json({ error: "Error de configuración del servidor" });
    }

    const token = jwt.sign(tokenPayload, secret, { expiresIn: "8h" });

    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
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
