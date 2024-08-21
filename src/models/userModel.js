import pool from "../database.js";
import bcrypt from "bcryptjs";

const createUser = async (email, password) => {
  console.log("Password received in createUser:", password); // Añadir log aquí

  if (!password) {
    throw new Error("La contraseña no puede ser undefined");
  }

  const saltRounds = 10;
  console.log("Hashing password:", password); 
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const result = await pool.query(
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING email, password',
    [email, hashedPassword]
  );

  return {
    email: result.rows[0].email,
    password: result.rows[0].password
  };
};

  
  

// Obtener un usuario por email
const getUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0];
};

export { createUser, getUserByEmail };
