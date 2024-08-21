// routes/invoiceRoutes.js
import express from 'express';
import {
    createFacturaController,
    getFacturasController,
    getFacturasByIdController,
    updateFacturaController,
    deleteFacturaController
} from '../controllers/facturaController.js';

const router = express.Router();

// Rutas para manejar facturas
router.post('/invoices', createFacturaController); // Crear una nueva factura
router.get('/invoices', getFacturasController); // Obtener todas las facturas
router.get('/invoices/:id', getFacturasByIdController); // Obtener una factura por su ID
router.put('/invoices/:id', updateFacturaController); // Actualizar una factura por su ID
router.delete('/invoices/:id', deleteFacturaController); // Eliminar una factura por su ID

export default router;
