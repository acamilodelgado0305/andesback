// controllers/paymentController.js
import {
    createPago,
    getPagos,
    getPagosById,
    updatePago,
    deletePago,
    getPagosByStudentId,
    updateEstadoPago,
    getPagosTotalByStudentId
} from '../models/paymentModel.js';

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import pool from '../database.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const renderTemplate = (templatePath, variables) => {
    let template = fs.readFileSync(templatePath, 'utf-8');
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, value);
    }
    return template;
};

// --- FUNCIÓN CENTRAL PARA REGISTRAR CUALQUIER TIPO DE PAGO ---
const createPagoController = async (req, res) => {
    const { student_id, tipo_pago_nombre, monto, periodo_pagado, metodo_pago, referencia_transaccion, observaciones, program_id } = req.body;

    if (!student_id || !tipo_pago_nombre || !monto || !metodo_pago) {
        return res.status(400).json({ error: 'Faltan datos requeridos para registrar el pago.' });
    }

    try {
        const tipoPagoResult = await pool.query('SELECT id FROM tipos_pago WHERE nombre = $1', [tipo_pago_nombre]);
        if (tipoPagoResult.rows.length === 0) {
            return res.status(400).json({ message: `Tipo de pago "${tipo_pago_nombre}" no encontrado.` });
        }
        const tipo_pago_id = tipoPagoResult.rows[0].id;

        let costo_esperado = parseFloat(monto);

        if (tipo_pago_nombre === 'Mensualidad') {
            if (!periodo_pagado) {
                return res.status(400).json({ error: 'El período de pago es requerido para las mensualidades.' });
            }
            if (!program_id) {
                return res.status(400).json({ error: 'El ID del programa es requerido para el pago de mensualidades.' });
            }

            const studentProgramInfo = await pool.query(
                `SELECT
                    s.nombre AS student_nombre,
                    s.apellido AS student_apellido,
                    i.monto AS costo_mensual_esperado,
                    i.nombre AS programa_nombre
                 FROM students s
                 JOIN estudiante_programas ep ON s.id = ep.estudiante_id
                 JOIN public.inventario i ON ep.programa_id = i.id
                 WHERE s.id = $1 AND ep.programa_id = $2`,
                [student_id, program_id]
            );

            if (studentProgramInfo.rows.length === 0) {
                return res.status(404).json({ message: `Estudiante ${student_id} no está inscrito en el programa ${program_id}, o programa no encontrado.` });
            }

            const { costo_mensual_esperado, student_nombre, student_apellido, programa_nombre } = studentProgramInfo.rows[0];
            costo_esperado = parseFloat(costo_mensual_esperado);

            if (parseFloat(monto) < costo_esperado) {
                console.warn(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Advertencia: El estudiante ${student_nombre} ${student_apellido} (ID: ${student_id}) pagó $${monto} por la mensualidad de ${periodo_pagado} del programa "${programa_nombre}", pero el costo esperado es $${costo_esperado}.`);
            } else if (parseFloat(monto) > costo_esperado) {
                console.warn(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Advertencia: El estudiante ${student_nombre} ${student_apellido} (ID: ${student_id}) pagó $${monto} por la mensualidad de ${periodo_pagado} del programa "${programa_nombre}", lo cual es mayor al costo esperado de $${costo_esperado}.`);
            }
        }

        const estado_pago_final = 'Pagado';

        const payment = await createPago(
            student_id,
            tipo_pago_id,
            monto,
            periodo_pagado || null,
            metodo_pago,
            referencia_transaccion || null,
            estado_pago_final,
            observaciones || null
        );

        if (tipo_pago_nombre === 'Matrícula') {
            await pool.query('UPDATE students SET estado_matricula = TRUE, updated_at = NOW() WHERE id = $1', [student_id]);
        }

        // --- Bloque de envío de correo (comentado por ti) ---
        /*
        const studentInfo = await pool.query('SELECT email, nombre, apellido FROM students WHERE id = $1', [student_id]);
        const studentEmail = studentInfo.rows[0]?.email;
        const studentFullName = `${studentInfo.rows[0]?.nombre} ${studentInfo.rows[0]?.apellido}`;

        if (studentEmail) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                }
            });

            const templatePath = path.join(__dirname, '../../templates', 'paymentConfirmationTemplate.html');
            const emailContent = renderTemplate(templatePath, {
                student_name: studentFullName,
                payment_date: new Date(payment.fecha_pago).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
                payment_type: tipo_pago_nombre,
                payment_amount: parseFloat(monto).toFixed(2),
                payment_period: periodo_pagado || 'N/A',
                payment_method: metodo_pago,
                reference_id: referencia_transaccion || 'N/A',
                costo_esperado_info: tipo_pago_nombre === 'Mensualidad' ? `(Costo esperado: $${costo_esperado.toFixed(2)})` : ''
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: studentEmail,
                subject: `Confirmación de Pago: ${tipo_pago_nombre}`,
                html: emailContent,
            };
            await transporter.sendMail(mailOptions);
            console.log(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Correo de confirmación de pago enviado a ${studentEmail}`);
        } else {
            console.warn(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] No se pudo enviar correo de confirmación: email del estudiante ${student_id} no encontrado.`);
        }
        */

        res.status(201).json(payment);

    } catch (err) {
        console.error(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Error al registrar pago:`, err);
        res.status(500).json({ error: 'Error interno del servidor al registrar el pago.' });
    }
};

// --- OBTENER TODOS LOS PAGOS ---
const getPagosController = async (req, res) => {
    try {
        const payments = await getPagos();
        res.status(200).json(payments);
    } catch (err) {
        console.error(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Error obteniendo pagos:`, err);
        res.status(500).json({ error: 'Error obteniendo pagos' });
    }
};

// --- OBTENER PAGOS POR ID DE ESTUDIANTE ---
const getPagosByStudentIdController = async (req, res) => {
    const { student_id } = req.params;
    try {
        const payments = await getPagosByStudentId(student_id);
        if (payments.length === 0) {
            // No devolver 404 si no hay pagos, solo un array vacío
            return res.status(200).json([]);
        }
        res.status(200).json(payments);
    } catch (err) {
        console.error(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Error obteniendo pagos del estudiante:`, err);
        res.status(500).json({ error: 'Error obteniendo pagos del estudiante' });
    }
};

// --- OBTENER PAGO POR ID DE PAGO ---
const getPagosByIdController = async (req, res) => {
    const { id } = req.params;
    try {
        const payment = await getPagosById(id);
        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        res.status(200).json(payment);
    } catch (err) {
        console.error(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Error obteniendo pago:`, err);
        res.status(500).json({ error: 'Error obteniendo pago' });
    }
};

// --- ACTUALIZAR PAGO (todos los campos) ---
const updatePagoController = async (req, res) => {
    const { id } = req.params;
    const { student_id, tipo_pago_id, monto, fecha_pago, periodo_pagado, metodo_pago, referencia_transaccion, estado, observaciones } = req.body;
    try {
        const payment = await updatePago(id, student_id, tipo_pago_id, monto, fecha_pago, periodo_pagado, metodo_pago, referencia_transaccion, estado, observaciones);
        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        res.status(200).json(payment);
    } catch (err) {
        console.error(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Error actualizando pago:`, err);
        res.status(500).json({ error: 'Error actualizando pago' });
    }
};

// --- ACTUALIZAR SOLO EL ESTADO DEL PAGO ---
const updateEstadoPagoController = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // 'Pagado', 'Pendiente', 'Anulado'

    try {
        const payment = await updateEstadoPago(id, estado);
        console.log(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Pago actualizado: ${JSON.stringify(payment)}`);

        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        // Lógica de envío de correo si el estado es 'Pagado' (o según tu lógica de negocio)
        if (estado === 'Pagado') {
            const studentInfo = await pool.query('SELECT email, nombre, apellido FROM students WHERE id = $1', [payment.student_id]);
            const studentEmail = studentInfo.rows[0]?.email;
            const studentFullName = `${studentInfo.rows[0]?.nombre} ${studentInfo.rows[0]?.apellido}`;

            if (!studentEmail) {
                console.warn(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Email del estudiante no encontrado para enviar notificación de estado de pago.`);
                // No retornar un error 400 aquí, ya que el pago ya se actualizó correctamente
            } else {
                 const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    }
                });

                const templatePath = path.join(__dirname, '../../templates', 'paymentStatusUpdateTemplate.html');
                const emailContent = renderTemplate(templatePath, {
                    student_name: studentFullName,
                    payment_id: payment.id,
                    payment_date: new Date(payment.fecha_pago).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
                    payment_amount: parseFloat(payment.monto).toFixed(2),
                    payment_status: estado,
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: studentEmail,
                    subject: `Actualización de Estado de Pago: ID ${payment.id}`,
                    html: emailContent,
                };
                await transporter.sendMail(mailOptions);
                console.log(`[${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}] Correo de actualización de estado de pago enviado a ${studentEmail}`);
            }
        } else {
            console.log(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Bogota' })}] Estado de pago no es 'Pagado', no se enviará correo de confirmación. Estado actual: ${estado}`);
        }
        res.status(200).json({
            message: `Estado de pago actualizado a "${estado}".` + (estado === 'Pagado' && studentEmail ? ' Correo enviado.' : ''),
            payment
        });
    } catch (err) {
        console.error(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Error actualizando estado de pago:`, err);
        res.status(500).json({ error: 'Error actualizando estado de pago' });
    }
};

// --- ELIMINAR PAGO ---
const deletePagoController = async (req, res) => {
    const { id } = req.params;
    try {
        const payment = await deletePago(id);
        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        res.status(200).json(payment);
    } catch (err) {
        console.error(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Error eliminando pago:`, err);
        res.status(500).json({ error: 'Error eliminando pago' });
    }
};

// --- OBTENER TOTAL PAGADO POR ESTUDIANTE (SUMA DE MONTOS DE PAGOS CON ESTADO 'Pagado') ---
const getTotalPagosByStudentIdController = async (req, res) => {
    const { student_id } = req.params;
    try {
        const totalPagado = await getPagosTotalByStudentId(student_id);
        res.status(200).json({ total_pagado: totalPagado });
    } catch (err) {
        console.error(`[${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}] Error obteniendo el total pagado del estudiante:`, err);
        res.status(500).json({ error: 'Error obteniendo el total pagado' });
    }
};

// --- Obtener información del programa de un estudiante (para el frontend) ---


// --- NUEVA FUNCIÓN PARA OBTENER LOS TIPOS DE PAGO ---
const getStudentProgramInfoController = async (req, res) => {
    const { student_id } = req.params;

    if (!student_id || isNaN(student_id)) {
        return res.status(400).json({ error: 'ID de estudiante inválido.' });
    }

    try {
        // QUERY CORREGIDA: Usamos una sintaxis de JOIN explícita con `unnest`.
        const query = `
            SELECT
                i.id AS programa_id,
                i.nombre AS programa_nombre,
                i.monto AS costo_mensual_esperado,
                s.nombre AS student_nombre,
                s.apellido AS student_apellido
            FROM
                students s
            -- FORMA CORRECTA Y EXPLÍCITA DE UNIR CON EL RESULTADO DE UNNEST
            JOIN 
                unnest(s.programas_ids) AS programa_id_en_array ON true
            JOIN 
                public.inventario i ON programa_id_en_array = i.id
            WHERE 
                s.id = $1;
        `;
        
        const result = await pool.query(query, [student_id]);

        if (result.rows.length > 0) {
            res.status(200).json(result.rows);
        } else {
            res.status(404).json({ message: 'No se encontraron programas asociados para este estudiante.' });
        }
    } catch (error) {
        console.error(`Error al obtener info de los programas del estudiante:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};


export {
    createPagoController,
    getPagosController,
    getPagosByIdController,
    updatePagoController,
    deletePagoController,
    getPagosByStudentIdController,
    updateEstadoPagoController,
    getTotalPagosByStudentIdController,
    getStudentProgramInfoController,
   // ¡Exportar la nueva función!
};