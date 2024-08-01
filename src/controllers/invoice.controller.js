// controllers/invoiceController.js
const Invoice = require('../models/invoice');
const Client = require('../models/client');

// Crear una nueva factura
exports.createInvoice = async (req, res) => {
  try {
    const { clienteId, monto, descripcion } = req.body;
    const invoice = new Invoice({ clienteId, monto, descripcion });
    await invoice.save();

    await Client.findByIdAndUpdate(clienteId, { $push: { facturas: invoice._id } }, { new: true });

    res.status(201).json(invoice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Obtener todas las facturas
exports.getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find();
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener una factura por ID
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Actualizar una factura por ID
exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' });
    res.status(200).json(invoice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Eliminar una factura por ID
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' });

    await Client.findByIdAndUpdate(invoice.clienteId, { $pull: { facturas: invoice._id } });

    res.status(200).json({ message: 'Factura eliminada' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
