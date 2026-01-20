import express from 'express';
import {
    createPagoController,               // Crear abono
    getPagosController,                 // Ver todos (Admin)
    getPagosByIdController,             // Ver uno detalle
    getPagosByStudentIdController,      // Historial del estudiante
    updatePagoController,               // Corregir pago
    deletePagoController,               // Eliminar pago
    updateEstadoPagoController,         // Aprobar/Anular
    getTotalPagosByStudentIdController, // Total acumulado
    getStudentProgramInfoController,    // <--- CLAVE: Trae la deuda y el estado de cuenta
    getPaymentTypesController           // Llenar select de tipos de pago
} from '../controllers/paymentController.js';

// Si tienes middleware de autenticación, impórtalo aquí:
// import { verifyToken, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// ==========================================
// RUTAS DE CONFIGURACIÓN Y UTILIDAD
// ==========================================

// Obtener los tipos de pago disponibles (Efectivo, Transferencia, etc.)
// Nota: Se coloca antes de las rutas con :id para evitar conflictos
router.get('/payment-types', getPaymentTypesController);
// (Si tu frontend llama a '/types_pago', mantén esa, pero '/payment-types' es más estándar)
// router.get('/types_pago', getPaymentTypesController); 


// ==========================================
// RUTAS PRINCIPALES DE PAGOS (CRUD)
// ==========================================

// Crear un nuevo pago (Abono a programa, Matrícula, etc.)
router.post('/payments', createPagoController);

// Obtener todos los pagos del sistema (Ideal para reporte general de Admin)
router.get('/payments', getPagosController);

// Obtener un pago específico por su ID
router.get('/payments/:id', getPagosByIdController);

// Actualizar un pago completo (Edición administrativa)
router.put('/payments/:id', updatePagoController);

// Actualizar solo el estado (ej. confirmar transferencia: Pendiente -> Pagado)
router.patch('/payments/:id/status', updateEstadoPagoController);

// Eliminar un pago (Revertir abono)
router.delete('/payments/:id', deletePagoController);


// ==========================================
// RUTAS ENFOCADAS EN EL ESTUDIANTE
// ==========================================

// 1. Obtener historial de pagos de un estudiante específico
router.get('/payments/student/:student_id', getPagosByStudentIdController);

// 2. Obtener el total acumulado pagado por un estudiante
router.get('/payments/student/:student_id/total-paid', getTotalPagosByStudentIdController);

// 3. ESTADO DE CUENTA (Cartera)
// Esta ruta devuelve los programas del estudiante, el costo total, 
// lo abonado hasta hoy y el saldo pendiente.
router.get('/students/:student_id/program-info', getStudentProgramInfoController);


export default router;