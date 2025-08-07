// src/models/inventarioModel.js
import pool from '../database.js';

// Crear un item de inventario
const createInventarioItem = async (nombre, monto, descripcion, user_id) => {
  const result = await pool.query(
    'INSERT INTO inventario (nombre, monto, descripcion, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [nombre, monto, descripcion, user_id]
  );
  return result.rows[0];
};

// Obtener todos los items de inventario de un usuario específico
// También puede obtener ítems maestros (user_id IS NULL) si user_id es null o si se usa para un administrador
const getInventarioItems = async (user_id = null) => { // Hacemos user_id opcional en el modelo para flexibilidad (ej. admin viendo todo)
  if (user_id !== null) { // Si se proporciona un user_id, filtramos por él
    const result = await pool.query('SELECT * FROM inventario WHERE user_id = $1', [user_id]);
    return result.rows;
  } else { // Si no se proporciona user_id, se asume que es para ver ítems maestros o para un admin (se ajustará en el controlador)
    const result = await pool.query('SELECT * FROM inventario WHERE user_id IS NULL'); // Retorna solo los ítems maestros por defecto
    return result.rows;
  }
};

// Obtener un item de inventario por ID
const getInventarioItemById = async (id) => {
  const result = await pool.query('SELECT * FROM inventario WHERE id = $1', [id]);
  return result.rows[0];
};

// Actualizar un item de inventario
const updateInventarioItem = async (id, nombre, monto, descripcion) => {
  const result = await pool.query(
    'UPDATE inventario SET nombre = $1, monto = $2, descripcion = $3 WHERE id = $4 RETURNING *',
    [nombre, monto, descripcion, id]
  );
  return result.rows[0];
};

// Eliminar un item de inventario
export const deleteInventarioItemsByIds = async (ids) => {
  const query = `
    DELETE FROM "public"."inventario"
    WHERE id = ANY($1::int[]);
  `;
  // Se eliminó la condición "AND user_id = $2"

  // El array de valores ahora solo necesita los IDs
  const values = [ids]; 
  
  const result = await pool.query(query, values);
  
  // `result.rowCount` devuelve el número de filas eliminadas.
  return result.rowCount;
};

const getInventarioItemsByUserId = async (userId) => {
  const result = await pool.query('SELECT * FROM inventario WHERE user_id = $1', [userId]);
  return result.rows;
};

export { createInventarioItem, getInventarioItems, getInventarioItemById, updateInventarioItem, getInventarioItemsByUserId };