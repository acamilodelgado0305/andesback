import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail } from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config(); // Asegúrate de cargar las variables de entorno

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secreto_seguro'; // Usa variable de entorno o un valor por defecto

// Registrar usuario
const registerController = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const user = await createUser(email, password);
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

export { registerController, loginController };
