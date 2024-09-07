// models/invoiceModel.js
import pool from "../database.js";
import cron from "node-cron";  // Importar node-cron

// Crear una factura
const createFactura = async (student_id, program_id, fecha, descripcion) => {
  // Obtener el valor del programa
  const programQuery = await pool.query(
    "SELECT monto FROM programas WHERE id = $1",
    [program_id]
  );

  // Verifica si el programa fue encontrado
  if (programQuery.rows.length === 0) {
    throw new Error("Programa no encontrado");
  }

  const monto = programQuery.rows[0].monto;

  // Insertar la factura con el estado inicial en false
  const result = await pool.query(
    `INSERT INTO facturas (student_id, program_id, fecha, monto, descripcion, estado) 
      VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
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
  descripcion,
  estado
) => {
  // Obtener el valor del programa
  const programQuery = await pool.query(
    "SELECT monto FROM programas WHERE id = $1",
    [program_id]
  );
  const monto = programQuery.rows[0].monto;

  const result = await pool.query(
    `UPDATE facturas 
    SET student_id = $1, program_id = $2, fecha = $3, monto = $4, descripcion = $5, estado =$6
    WHERE id = $7 RETURNING *`,
    [student_id, program_id, fecha, monto, descripcion, estado, id]
  );
  return result.rows[0];
};


const updateEstadoFactura = async (id, estado) => {
  const result = await pool.query(
    `UPDATE facturas 
    SET estado = $1
    WHERE id = $2 RETURNING *`,
    [estado, id]
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

const getFacturasByStudentId = async (student_id) => {
  const result = await pool.query("SELECT * FROM facturas WHERE student_id = $1", [student_id]);
  return result.rows;
};

// Función para generar facturas automáticamente el primer día de cada mes


export {
  createFactura,
  getFacturas,
  getFacturasById,
  updateFactura,
  deleteFactura,
  getFacturasByStudentId,
  updateEstadoFactura
};
