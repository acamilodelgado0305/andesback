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
  