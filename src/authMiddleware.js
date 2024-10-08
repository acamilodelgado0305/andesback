import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secreto_seguro';

// Middleware para verificar token JWT
const verifyToken = (req, res, next) => {
    // Obtener el token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado, no autenticado' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.userId = verified.userId;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token no válido o expirado' });
    }
};

export default verifyToken;
