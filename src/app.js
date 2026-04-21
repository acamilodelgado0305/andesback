import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import StudentRouter from "./routes/studentRouter.js";
import InventarioRouter from "./routes/inventarioRouter.js";
import RegistroRouter from "./routes/registroRouter.js";
import authRouter from './routes/authRouter.js';
import facturaRouter from './routes/facturaRouter.js';
import subjectRouter from './routes/subjectRoutes.js'
import GradesRouter from './routes/GradesRouter.js'
import CertificadosRouter from "./routes/certificadoRoutes.js"
import adminrRoutes from './routes/admin/adminRoutes.js'
import docentesRouter from './routes/docentesRouter.js'
import materiasRouter from './routes/materiasRouter.js'
import horariosRouter from './routes/horariosRouter.js'
import evaluacionesRouter from "./routes/evaluacionesRouter.js"
import programasRoutes from "./routes/programasRoutes.js"
import studentAuthRouter from "./routes/studentAuthRoutes.js"
import cierresRouter from "./routes/cierresRouter.js"
import dotenv from "dotenv";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.set('port', PORT);

// Incluye los módulos necesarios para la autenticación
app.use(cookieParser());
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://andesfront.onrender.com',
    'https://quickcontrola.com',
    'https://rapictrl.com',
    'https://santasofia.vercel.app',
];

app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
        // Permite requests sin origin (Postman, mobile apps, same-origin)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS bloqueado: ${origin}`));
        }
    }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rutas PÚBLICAS del portal de estudiantes (SIN autenticación) ───
// IMPORTANTE: Debe ir ANTES de cualquier router que use authMiddleware global
app.use('/api/student-portal', studentAuthRouter);

// Rutas públicas (sin protección)
app.use('/api', authRouter);
app.use('/api', programasRoutes);
app.use('/api', CertificadosRouter);
app.use('/api', RegistroRouter);
app.use('/api', facturaRouter);
app.use('/api', subjectRouter);
app.use('/api', GradesRouter);

app.use('/api', adminrRoutes);
app.use('/api', docentesRouter);
app.use('/api', materiasRouter);
app.use('/api', horariosRouter);
app.use('/api', evaluacionesRouter);

// Rutas protegidas (requieren autenticación con token)
app.use('/api', cierresRouter);
app.use('/api', StudentRouter);
app.use('/api', InventarioRouter);

// Middleware para manejar errores (DEBE ir al final, después de todas las rutas)
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).send('Error interno del servidor');
});

export default app;