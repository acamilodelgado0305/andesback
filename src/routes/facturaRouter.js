// routes/invoiceRoutes.js
import express from 'express';
import {
    createFacturaController,
    getFacturasController,
    getFacturasByIdController,
    getFacturasByStudentIdController, // Importar el nuevo controlador
    updateFacturaController,
    deleteFacturaController,
    generateMonthlyInvoicesController
} from '../controllers/facturaController.js';

const router = express.Router();

// Rutas para manejar facturas
router.post('/invoices', createFacturaController); // Crear una nueva factura
router.post('/generate-monthly', generateMonthlyInvoicesController); // Generar facturas mensuales automáticamente
router.get('/invoices', getFacturasController); // Obtener todas las facturas
router.get('/invoices/:id', getFacturasByIdController); // Obtener una factura por su ID
router.get('/invoices/student/:student_id', getFacturasByStudentIdController); // Obtener facturas por ID de estudiante
router.put('/invoices/:id', updateFacturaController); // Actualizar una factura por su ID
router.delete('/invoices/:id', deleteFacturaController); // Eliminar una factura por su ID

export default router;
