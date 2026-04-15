// src/middlewares/flexAuthMiddleware.js
// Middleware flexible: acepta token de admin (authToken) O token de estudiante (student_portal_token).
// Útil para rutas compartidas (ejemplo: grades, evaluaciones, horarios) que pueden ser
// accedidas tanto por admins como por estudiantes autenticados.
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secreto_seguro';

/**
 * flexAuthMiddleware
 * - Si el token tiene `sub` → es un token de admin → setea req.user
 * - Si el token tiene `studentId` → es un token de estudiante → setea req.student
 * - Si no hay token → 401
 */
export const flexAuthMiddleware = (req, res, next) => {
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

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: 'Token no proporcionado.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Token de admin (tiene "sub" como ID del usuario)
    if (decoded.sub) {
      req.user = {
        id: decoded.sub,
        name: decoded.name,
        role: decoded.role,
        bid: decoded.bid,
        scope: decoded.scope,
        raw: decoded,
      };
      return next();
    }

    // Token de estudiante (tiene "studentId")
    if (decoded.studentId) {
      req.student = {
        id: decoded.studentId,
        documento: decoded.documento,
        role: decoded.role || 'student',
      };
      return next();
    }

    // Token válido pero sin claims reconocidos
    return res.status(401).json({
      ok: false,
      error: 'Token sin permisos reconocidos.',
    });
  } catch (error) {
    console.error('Error en flexAuthMiddleware:', error.message);
    return res.status(401).json({
      ok: false,
      error: 'Token inválido o expirado.',
    });
  }
};
