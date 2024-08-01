import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

const URI = process.env.MONGODB_URI;

mongoose
    .connect(URI)
    .then(() => console.log("Conectado a Mongo feva"))
    .catch((error) => console.error(error));
