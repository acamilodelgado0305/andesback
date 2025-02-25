// controllers/invoiceController.js
import {
  createFactura,
  getFacturas,
  getFacturasById,
  updateFactura,
  deleteFactura,
  getFacturasByStudentId,
  updateEstadoFactura,
  getTotalFacturasPagadasByStudentId
} from '../models/facturaModel.js';

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import pool from '../database.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';


// Obtener el directorio actual del archivo
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Función para cargar y reemplazar variables en la plantilla HTML
const renderTemplate = (templatePath, variables) => {
  let template = fs.readFileSync(templatePath, 'utf-8');
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(regex, value);
  }
  return template;
};

const createFacturaController = async (req, res) => {
  const { student_id, program_id, fecha, descripcion } = req.body;

  // Validar datos
  if (!student_id || !program_id || !fecha) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    // Crear la factura
    const invoice = await createFactura(student_id, program_id, fecha, descripcion);
    res.status(201).json(invoice);
  } catch (err) {
    console.error('Error creando factura', err);
    res.status(500).json({ error: 'Error creando factura' });
  }
};


const getFacturasController = async (req, res) => {
  try {
    const invoices = await getFacturas();
    res.status(200).json(invoices);
  } catch (err) {
    console.error('Error obteniendo facturas', err);
    res.status(500).json({ error: 'Error obteniendo facturas' });
  }
};


const getFacturasByStudentIdController = async (req, res) => {
  const { student_id } = req.params;
  try {
    const invoices = await getFacturasByStudentId(student_id);
    if (invoices.length === 0) {
      return res.status(404).json({ error: 'No se encontraron facturas para este estudiante' });
    }
    res.status(200).json(invoices);
  } catch (err) {
    console.error('Error obteniendo facturas del estudiante', err);
    res.status(500).json({ error: 'Error obteniendo facturas del estudiante' });
  }
};

const getFacturasByIdController = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await getFacturasById(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    res.status(200).json(invoice);
  } catch (err) {
    console.error('Error obteniendo factura', err);
    res.status(500).json({ error: 'Error obteniendo factura' });
  }
};

const updateFacturaController = async (req, res) => {
  const { id } = req.params;
  const { student_id, program_id, fecha, descripcion, estado } = req.body;
  try {
    const invoice = await updateFactura(id, student_id, program_id, fecha, descripcion, estado);
    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    res.status(200).json(invoice);
  } catch (err) {
    console.error('Error actualizando factura', err);
    res.status(500).json({ error: 'Error actualizando factura' });
  }
};

const updateEstadoFacturaController = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const invoice = await updateEstadoFactura(id, estado);
    console.log(`Factura actualizada: ${JSON.stringify(invoice)}`);

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }


    if (estado === true) {

      const result = await pool.query('SELECT email, nombre FROM students WHERE id = $1', [invoice.student_id]);
      const studentEmail = result.rows[0]?.email;
      const studentName = result.rows[0]?.nombre;
      if (!studentEmail) {
        return res.status(400).json({ error: 'Estudiante no encontrado' });
      }

      // Configuración de Nodemailer
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        }
      });

      // Cargar la plantilla de correo
      const templatePath = path.join(__dirname, '../../templates', 'adminNotificationTemplate.html');
      const emailContent = renderTemplate(templatePath, {
        student_name: studentName,
        invoice_date: new Date(invoice.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),  // Formato de fecha
        description: invoice.descripcion,
        invoice_amount: invoice.monto,
        invoice_status: estado === true ? 'Pagado' : 'Pendiente',
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: studentEmail,
        subject: 'Factura Pagada',
        html: emailContent,
      };
      await transporter.sendMail(mailOptions);
      console.log('Correo enviado exitosamente');

    } else {
      console.log(`Factura no pagada, no se enviará correo. Estado actual: ${estado}`);
    }
    res.status(200).json({
      message: `Factura actualizada, estado: ${estado === true ? 'enviado' : 'no enviado'} correo.`,
      invoice
    });
  } catch (err) {
    console.error('Error actualizando factura', err);
    res.status(500).json({ error: 'Error actualizando factura' });
  }
};

const deleteFacturaController = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await deleteFactura(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    res.status(200).json(invoice);
  } catch (err) {
    console.error('Error eliminando factura', err);
    res.status(500).json({ error: 'Error eliminando factura' });
  }
};

const getTotalFacturasPagadasByStudentIdController = async (req, res) => {
  const { student_id } = req.params;
  try {
    const totalPagado = await getTotalFacturasPagadasByStudentId(student_id);
    res.status(200).json({ total_pagado: totalPagado });
  } catch (err) {
    console.error('Error obteniendo el total pagado', err);
    res.status(500).json({ error: 'Error obteniendo el total pagado' });
  }
};





export {
  createFacturaController,
  getFacturasController,
  getFacturasByIdController,
  updateFacturaController,
  deleteFacturaController,
  getFacturasByStudentIdController,
  updateEstadoFacturaController,
  getTotalFacturasPagadasByStudentIdController
};
