// routes/paymentRoutes.js
import express from 'express';
import {
    createPagoController,           // Renombrado de createFacturaController
    getPagosController,             // Renombrado de getFacturasController
    getPagosByIdController,         // Renombrado de getFacturasByIdController
    getPagosByStudentIdController,  // Renombrado de getFacturasByStudentIdController
    updatePagoController,           // Renombrado de updateFacturaController
    deletePagoController,           // Renombrado de deleteFacturaController
    updateEstadoPagoController,     // Renombrado de updateEstadoFacturaController
    getTotalPagosByStudentIdController, // Renombrado de getTotalFacturasPagadasByStudentIdController
    getStudentProgramInfoController, // Nueva función para obtener info de programa
    getPaymentTypesController 
} from '../controllers/paymentController.js'; // Asegúrate de la ruta correcta al nuevo controlador

const router = express.Router();

//-----------------POST-------------------//
// Crear un nuevo pago (mensualidad, matrícula, derechos de grado)
router.post('/payments', createPagoController);


//------------------GET---------------------//
// Obtener todos los pagos
router.get('/payments', getPagosController);

// Obtener un pago por su ID
router.get('/payments/:id', getPagosByIdController);
router.get('/types_pago', getPaymentTypesController);

// Obtener todos los pagos de un estudiante por su ID
// **Ojo: Tenías esta ruta duplicada y con el mismo patrón 'invoices/student/:student_id'**
// Asegúrate de que las rutas sean únicas para evitar conflictos.
// La he dejado una vez aquí.
router.get('/payments/student/:student_id', getPagosByStudentIdController);

// Obtener el total pagado por un estudiante (suma de pagos con estado 'Pagado')
router.get('/payments/student/:student_id/total-paid', getTotalPagosByStudentIdController);

// Obtener información del programa de un estudiante (costo mensual esperado)
router.get('/students/:student_id/program-info', getStudentProgramInfoController);


//------------------PUT---------------------------//
// Actualizar un pago completo por su ID
router.put('/payments/:id', updatePagoController);

// Actualizar el estado de un pago por su ID (ej. de 'Pendiente' a 'Pagado')
router.patch('/payments/:id/status', updateEstadoPagoController); // Se usa PATCH para actualizaciones parciales


//---------------DELETE-----------------------------//
// Eliminar un pago por su ID
router.delete('/payments/:id', deletePagoController);

export default router;