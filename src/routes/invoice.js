// routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// Rutas para facturas
router.post('/invoices', invoiceController.createInvoice);
router.get('/invoices', invoiceController.getInvoices);
router.get('/invoices/:id', invoiceController.getInvoiceById);
router.put('/invoices/:id', invoiceController.updateInvoice);
router.delete('/invoices/:id', invoiceController.deleteInvoice);

module.exports = router;
