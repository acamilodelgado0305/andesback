import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER, // Cambiado de "username" a "user"
  password: process.env.PGPASSWORD,
  port: 5432, // Puedes ajustar este puerto si es necesario
  ssl: {
    rejectUnauthorized: false, // Configuración de SSL
  },
});

pool.on("connect", () => {
  console.log("Conectado a la base de datos PostgreSQL");
});

pool.on("error", (err) => {
  console.error("Error en la conexión con PostgreSQL", err);
  process.exit(-1);
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("Conexión exitosa a la base de datos PostgreSQL");
  } catch (err) {
    console.error("Error probando la conexión con PostgreSQL", err);
  }
};

testConnection();

export default pool;
