// controllers/authController.js
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail } from '../models/userModel.js';
import bcrypt from 'bcryptjs';

// Registrar usuario
const registerController = async (req, res) => {
  const { email, password } = req.body;

  // Verifica que email y password no estén vacíos
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

    const token = jwt.sign({ userId: user.id }, 'tu_secreto_jwt', { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true }).json({ message: 'Inicio de sesión exitoso' });
  } catch (err) {
    console.error('Error iniciando sesión', err);
    res.status(500).json({ error: 'Error iniciando sesión' });
  }
};

// Verificar token JWT
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado, no autenticado' });
  }

  try {
    const verified = jwt.verify(token, 'tu_secreto_jwt');
    req.userId = verified.userId;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token no válido' });
  }
};

export { registerController, loginController, verifyToken };
