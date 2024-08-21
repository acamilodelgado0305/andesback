// controllers/invoiceController.js
import {
    createFactura,
    getFacturas,
    getFacturasById,
    updateFactura,
    deleteFactura
  } from '../models/facturaModel.js';
  
  const createFacturaController = async (req, res) => {
    const { student_id, program_id, fecha,monto, descripcion } = req.body;
  
    // Validar datos
    if (!student_id || !program_id || !fecha) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
  
    try {
      // Crear la factura
      const invoice = await createFactura(student_id, program_id, fecha,monto, descripcion);
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
    const { student_id, program_id, fecha, descripcion } = req.body;
    try {
      const invoice = await updateFactura(id, student_id, program_id, fecha, descripcion);
      if (!invoice) {
        return res.status(404).json({ error: 'Factura no encontrada' });
      }
      res.status(200).json(invoice);
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
  
  export {
    createFacturaController,
    getFacturasController,
    getFacturasByIdController,
    updateFacturaController,
    deleteFacturaController
  };
  