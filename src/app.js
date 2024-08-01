import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import studentRoutes from './routes/student.js'; // Importa la ruta

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

// Rutas protegidas (requieren autenticación)
app.use('/student', studentRoutes); // Usa el módulo importado

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor en ejecución en http://localhost:${PORT}`);
});

export default app;
