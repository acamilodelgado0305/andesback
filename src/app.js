import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import StudentRouter from "./routes/studentRouter.js"
import ProgramRouter from "./routes/programRouter.js"
import RegistroRouter from "./routes/registroRouter.js"
import authRouter from './routes/authRouter.js';
import facturaRouter from './routes/facturaRouter.js'
import { verifyToken } from './controllers/authController.js'; 


const app = express();
const PORT = 7000;

// Incluye los módulos necesarios para la autenticación

app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: ['http://localhost:5173']
}));
app.use(express.json());

// Middleware para manejar errores
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    // Puedes enviar una respuesta de error al cliente o realizar otras acciones aquí
    res.status(500).send('Error interno del servidor');
});


app.use('/auth', authRouter);

app.use('/api', StudentRouter); 
app.use('/api', ProgramRouter); 
app.use('/api', RegistroRouter);
app.use('/api', facturaRouter);


// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});

export default app;
