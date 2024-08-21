// models/invoiceModel.js
import pool from "../database.js";

// Crear una factura
const createFactura = async (student_id, program_id, fecha, descripcion) => {
  // Obtener el valor del programa
  const programQuery = await pool.query(
    "SELECT valor FROM programas WHERE id = $1",
    [program_id]
  );

  // Verifica si el programa fue encontrado
  if (programQuery.rows.length === 0) {
    throw new Error("Programa no encontrado");
  }

  const monto = programQuery.rows[0].valor;

  // Insertar la factura
  const result = await pool.query(
    `INSERT INTO facturas (student_id, program_id, fecha, monto, descripcion) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [student_id, program_id, fecha, monto, descripcion]
  );
  return result.rows[0];
};

// Obtener todas las facturas
const getFacturas = async () => {
  const result = await pool.query("SELECT * FROM facturas");
  return result.rows;
};

// Obtener una factura por ID
const getFacturasById = async (id) => {
  const result = await pool.query("SELECT * FROM facturas WHERE id = $1", [id]);
  return result.rows[0];
};

// Actualizar una factura
const updateFactura = async (
  id,
  student_id,
  program_id,
  fecha,
  descripcion
) => {
  // Obtener el valor del programa
  const programQuery = await pool.query(
    "SELECT valor FROM programas WHERE id = $1",
    [program_id]
  );
  const monto = programQuery.rows[0].valor;

  const result = await pool.query(
    `UPDATE facturas 
    SET student_id = $1, program_id = $2, fecha = $3, monto = $4, descripcion = $5 
    WHERE id = $6 RETURNING *`,
    [student_id, program_id, fecha, monto, descripcion, id]
  );
  return result.rows[0];
};

// Eliminar una factura
const deleteFactura = async (id) => {
  const result = await pool.query(
    "DELETE FROM facturas WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

export {
  createFactura,
  getFacturas,
  getFacturasById,
  updateFactura,
  deleteFactura,
};
