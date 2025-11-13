// src/middlewares/studentAuthMiddleware.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'DEV_STUDENT_JWT_SECRET';

export const studentAuthMiddleware = (req, res, next) => {
  try {
    const authHeader =
      req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        error: 'Token no proporcionado.',
      });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('Error verificando token estudiante:', err);
        return res.status(401).json({
          ok: false,
          error: 'Token inválido o expirado.',
        });
      }

      // Guardamos los datos útiles en la request
      req.student = {
        id: decoded.studentId,
        documento: decoded.documento,
        role: decoded.role || 'student',
      };

      next();
    });
  } catch (error) {
    console.error('Error en studentAuthMiddleware:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno de autenticación.',
    });
  }
};
