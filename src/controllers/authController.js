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
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

    // Enviar el token en la respuesta para que el frontend lo gestione
    res.json({ token, message: 'Inicio de sesión exitoso' });
  } catch (err) {
    console.error('Error iniciando sesión', err);
    res.status(500).json({ error: 'Error iniciando sesión' });
  }
};


const getUserByIdController = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'El ID del usuario es requerido' });
  }

  try {
    const result = await pool.query('SELECT id, email,name, created_at, updated_at FROM users WHERE id = $1', [id]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error obteniendo usuario por ID', err);
    res.status(500).json({ error: 'Error obteniendo usuario por ID' });
  }
};

export { registerController, loginController, getUserByIdController};
