import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import StudentRouter from "./routes/studentRouter.js";
import ProgramRouter from "./routes/programRouter.js";
import RegistroRouter from "./routes/registroRouter.js";
import authRouter from './routes/authRouter.js';
import facturaRouter from './routes/facturaRouter.js';
import subjectRouter from './routes/subjectRoutes.js'
import GradesRouter from './routes/GradesRouter.js'
import verifyToken from './authMiddleware.js';
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7001;

app.set('port', PORT);

// Incluye los módulos necesarios para la autenticación
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: ['http://localhost:5173', 'https://andesfront.onrender.com', 'https://validaciondebachillerato.com.co', 'https://santasofia.vercel.app']
}));
app.use(express.json());

// Middleware para manejar errores
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).send('Error interno del servidor');
});

// Rutas públicas (sin protección)
app.use('/api', authRouter);

// Rutas protegidas (requieren autenticación con token)
app.use('/api', StudentRouter);
app.use('/api',  ProgramRouter);
app.use('/api', RegistroRouter);
app.use('/api',  facturaRouter);
app.use('/api',  subjectRouter);
app.use('/api',  GradesRouter);

export default app;