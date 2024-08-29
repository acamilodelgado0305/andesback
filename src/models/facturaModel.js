// models/invoiceModel.js
import pool from "../database.js";
import cron from "node-cron";  // Importar node-cron

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
    "SELECT valor FROM programas WHERE id = $1",
    [program_id]
  );
  const monto = programQuery.rows[0].valor;

  const result = await pool.query(
    `UPDATE facturas 
    SET student_id = $1, program_id = $2, fecha = $3, monto = $4, descripcion = $5, estado =$6
    WHERE id = $7 RETURNING *`,
    [student_id, program_id, fecha, monto, descripcion, estado, id]
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
const generateMonthlyInvoices = async () => {
  try {
    // Obtener todos los estudiantes
    const studentsQuery = await pool.query("SELECT id FROM estudiantes");

    // Fecha actual formateada para el primer día del mes
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // Iterar sobre cada estudiante y crear una factura
    for (const student of studentsQuery.rows) {
      const student_id = student.id;

      // Aquí podrías personalizar el program_id y descripcion según tus necesidades
      const program_id = 1; // Por ejemplo, podrías hacer un query para obtener el program_id relacionado al estudiante
      const descripcion = 'Factura generada automáticamente para el primer día del mes';

      // Crear la factura
      await createFactura(student_id, program_id, firstDayOfMonth, descripcion);
    }

    console.log("Facturas generadas automáticamente para todos los estudiantes.");
  } catch (error) {
    console.error('Error generando facturas automáticamente', error);
  }
};

// Programar la tarea para que se ejecute el primer día de cada mes a la medianoche
cron.schedule('0 0 1 * *', () => {
  console.log('Iniciando generación automática de facturas para el primer día del mes');
  generateMonthlyInvoices();
});

export {
  createFactura,
  getFacturas,
  getFacturasById,
  updateFactura,
  deleteFactura,
  generateMonthlyInvoices,
  getFacturasByStudentId
};
