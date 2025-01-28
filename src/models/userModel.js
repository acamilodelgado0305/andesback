import pool from "../database.js";
import bcrypt from "bcryptjs";


const createUser = async (email, password, name) => {
  console.log("Password received in createUser:", password);

  if (!password) {
    throw new Error("La contraseña no puede ser undefined");
  }
  
  if (!name) {
    throw new Error("El nombre no puede ser undefined");
  }

  const saltRounds = 10;
  console.log("Hashing password:", password); 
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const result = await pool.query(
    'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING email, password, name',
    [email, hashedPassword, name]
  );

  return {
    email: result.rows[0].email,
    password: result.rows[0].password,
    name: result.rows[0].name
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
