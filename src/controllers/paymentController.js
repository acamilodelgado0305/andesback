import pool from '../database.js';
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
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configuración para rutas de templates (ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Función auxiliar para renderizar HTML de correos
const renderTemplate = (templatePath, variables) => {
    let template = fs.readFileSync(templatePath, 'utf-8');
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, value);
    }
    return template;
};

// =====================================================================
// 1. OBTENER INFORMACIÓN FINANCIERA DEL ESTUDIANTE (Cartera)
// =====================================================================
export const getStudentProgramInfoController = async (req, res) => {
    const { student_id } = req.params;
    const studentId = parseInt(student_id, 10);

    if (!studentId || isNaN(studentId)) {
        return res.status(400).json({ error: "ID de estudiante inválido." });
    }

    try {
        // Esta consulta es el CORAZÓN del nuevo sistema.
        // 1. Busca los programas del estudiante.
        // 2. Suma todos los pagos con estado 'Pagado' asociados a ese programa.
        // 3. Calcula la deuda (Monto Total - Abonos).
        const query = `
            SELECT 
                s.id AS student_id,
                s.nombre || ' ' || s.apellido AS student_nombre,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'programa_id', p.id,
                            'programa_nombre', p.nombre,
                            'monto_total', COALESCE(p.monto_total, 0),
                            'total_abonado', COALESCE(pagos_calc.total_pagado, 0),
                            'saldo_pendiente', (COALESCE(p.monto_total, 0) - COALESCE(pagos_calc.total_pagado, 0))
                        )
                    ) FILTER (WHERE p.id IS NOT NULL), 
                    '[]'::json
                ) AS programas_financiero
            FROM students s
            LEFT JOIN estudiante_programas ep ON s.id = ep.estudiante_id
            LEFT JOIN programas p ON ep.programa_id = p.id
            LEFT JOIN (
                SELECT student_id, program_id, SUM(monto) as total_pagado
                FROM pagos 
                WHERE estado = 'Pagado'
                GROUP BY student_id, program_id
            ) pagos_calc ON s.id = pagos_calc.student_id AND p.id = pagos_calc.program_id
            WHERE s.id = $1
            GROUP BY s.id, s.nombre, s.apellido;
        `;

        const result = await pool.query(query, [studentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Estudiante no encontrado." });
        }

        return res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error("Error al obtener info financiera:", error);
        return res.status(500).json({ message: "Error interno del servidor." });
    }
};

// =====================================================================
// 2. REGISTRAR UN NUEVO PAGO (ABONO)
// =====================================================================
export const createPagoController = async (req, res) => {
    const {
        student_id,
        tipo_pago_nombre,
        monto,
        periodo_pagado, // Ahora es opcional/informativo
        metodo_pago,
        referencia_transaccion,
        observaciones,
        program_id // ¡CRUCIAL! Para saber a qué deuda abonar
    } = req.body;

    // Validaciones básicas
    if (!student_id || !tipo_pago_nombre || !monto || !metodo_pago) {
        return res.status(400).json({ error: 'Faltan datos requeridos (estudiante, tipo pago, monto, método).' });
    }

    try {
        // A. Obtener ID del tipo de pago
        const tipoPagoResult = await pool.query('SELECT id FROM tipos_pago WHERE nombre = $1', [tipo_pago_nombre]);
        if (tipoPagoResult.rows.length === 0) {
            return res.status(400).json({ message: `Tipo de pago "${tipo_pago_nombre}" no existe.` });
        }
        const tipo_pago_id = tipoPagoResult.rows[0].id;

        // B. Validaciones de Negocio (Deuda)
        // Si el pago está asociado a un programa, verificamos no pagar de más (opcional, solo warning)
        if (program_id) {
            const saldoQuery = `
                SELECT p.monto_total, COALESCE(SUM(pg.monto), 0) as total_pagado
                FROM programas p
                LEFT JOIN pagos pg ON p.id = pg.program_id 
                    AND pg.student_id = $1 
                    AND pg.estado = 'Pagado'
                WHERE p.id = $2
                GROUP BY p.id;
            `;
            const saldoCheck = await pool.query(saldoQuery, [student_id, program_id]);

            if (saldoCheck.rows.length > 0) {
                const { monto_total, total_pagado } = saldoCheck.rows[0];
                const deuda_actual = parseFloat(monto_total) - parseFloat(total_pagado);

                if (parseFloat(monto) > deuda_actual) {
                    console.warn(`[WARN] El abono ($${monto}) supera la deuda actual ($${deuda_actual}) del estudiante ID ${student_id}.`);
                    // Podrías retornar 400 aquí si quieres prohibir pagar de más, 
                    // por ahora permitimos saldo a favor.
                }
            }
        }

        // C. Insertar en Base de Datos
        // NOTA: Asegúrate de que tu modelo `createPago` acepte el argumento extra `program_id`
        // Si usas query directo aquí:
        const insertQuery = `
            INSERT INTO pagos (
                student_id, tipo_pago_id, monto, periodo_pagado, 
                metodo_pago, referencia_transaccion, estado, observaciones, program_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            RETURNING *;
        `;

        const estado_inicial = 'Pagado'; // O 'Pendiente' según tu flujo
        const values = [
            student_id,
            tipo_pago_id,
            monto,
            periodo_pagado || null,
            metodo_pago,
            referencia_transaccion || null,
            estado_inicial,
            observaciones || null,
            program_id || null // Insertamos el ID del programa
        ];

        const result = await pool.query(insertQuery, values);
        const payment = result.rows[0];

        // D. Lógica específica de Matrícula (activar estudiante)
        if (tipo_pago_nombre === 'Matrícula') {
            await pool.query('UPDATE students SET estado_matricula = TRUE, updated_at = NOW() WHERE id = $1', [student_id]);
        }

        // E. Enviar Correo (Opcional, mantener tu lógica)
        // ... (Tu bloque de nodemailer aquí si deseas mantenerlo) ...

        res.status(201).json(payment);

    } catch (err) {
        console.error(`Error al registrar pago:`, err);
        res.status(500).json({ error: 'Error interno al registrar pago.' });
    }
};

// =====================================================================
// 3. OBTENER TIPOS DE PAGO (Para el Select del Frontend)
// =====================================================================
export const getPaymentTypesController = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, nombre FROM tipos_pago ORDER BY nombre ASC;');
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener tipos de pago:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// =====================================================================
// 4. OBTENER PAGOS POR ESTUDIANTE (Con info del programa)
// =====================================================================
export const getPagosByStudentIdController = async (req, res) => {
    const { student_id } = req.params;
    try {
        // Join con tipos_pago y programas para mostrar nombres
        const query = `
            SELECT 
                pg.*, 
                tp.nombre as tipo_pago_nombre,
                p.nombre as programa_nombre
            FROM pagos pg
            JOIN tipos_pago tp ON pg.tipo_pago_id = tp.id
            LEFT JOIN programas p ON pg.program_id = p.id
            WHERE pg.student_id = $1
            ORDER BY pg.fecha_pago DESC;
        `;
        const { rows } = await pool.query(query, [student_id]);

        res.status(200).json(rows);
    } catch (err) {
        console.error('Error obteniendo historial:', err);
        res.status(500).json({ error: 'Error obteniendo historial de pagos' });
    }
};

// =====================================================================
// 5. OBTENER TODOS LOS PAGOS (Admin General)
// =====================================================================
export const getPagosController = async (req, res) => {
    try {
        const query = `
            SELECT pg.*, tp.nombre as tipo_pago_nombre, s.nombre as estudiante_nombre, s.apellido as estudiante_apellido
            FROM pagos pg
            JOIN tipos_pago tp ON pg.tipo_pago_id = tp.id
            JOIN students s ON pg.student_id = s.id
            ORDER BY pg.fecha_pago DESC
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error obteniendo pagos:', err);
        res.status(500).json({ error: 'Error obteniendo pagos' });
    }
};

// =====================================================================
// 6. ACTUALIZAR PAGO
// =====================================================================
export const updatePagoController = async (req, res) => {
    const { id } = req.params;
    const {
        monto, fecha_pago, periodo_pagado, metodo_pago,
        referencia_transaccion, estado, observaciones, program_id
    } = req.body;

    try {
        const query = `
            UPDATE pagos
            SET monto = $1, fecha_pago = $2, periodo_pagado = $3, 
                metodo_pago = $4, referencia_transaccion = $5, estado = $6, 
                observaciones = $7, program_id = $8, updated_at = NOW()
            WHERE id = $9
            RETURNING *;
        `;
        const values = [
            monto, fecha_pago, periodo_pagado, metodo_pago,
            referencia_transaccion, estado, observaciones, program_id, id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error actualizando pago:', err);
        res.status(500).json({ error: 'Error actualizando pago' });
    }
};

// =====================================================================
// 7. ACTUALIZAR ESTADO DE PAGO (Y Enviar Correo)
// =====================================================================
export const updateEstadoPagoController = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    try {
        const query = `UPDATE pagos SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
        const result = await pool.query(query, [estado, id]);
        const payment = result.rows[0];

        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }

        // Lógica de Correo (Solo si pasa a Pagado)
        if (estado === 'Pagado') {
            const studentQuery = 'SELECT email, nombre, apellido FROM students WHERE id = $1';
            const studentRes = await pool.query(studentQuery, [payment.student_id]);

            if (studentRes.rows.length > 0) {
                const { email, nombre, apellido } = studentRes.rows[0];

                // Configurar Transporter (Asegúrate de tener tus .env configurados)
                if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS,
                        }
                    });

                    // Renderizar plantilla simple si no existe archivo
                    const htmlContent = `
                        <h1>Pago Confirmado</h1>
                        <p>Hola ${nombre} ${apellido},</p>
                        <p>Hemos recibido tu pago de <strong>$${parseFloat(payment.monto).toLocaleString()}</strong>.</p>
                        <p>Estado: ${estado}</p>
                    `;

                    await transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: email,
                        subject: `Confirmación de Pago - ID ${payment.id}`,
                        html: htmlContent
                    });
                }
            }
        }

        res.status(200).json({ message: `Estado actualizado a ${estado}`, payment });

    } catch (err) {
        console.error('Error actualizando estado:', err);
        res.status(500).json({ error: 'Error al actualizar estado.' });
    }
};

// =====================================================================
// 8. ELIMINAR PAGO
// =====================================================================
export const deletePagoController = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM pagos WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        res.status(200).json({ message: 'Pago eliminado', deleted: result.rows[0] });
    } catch (err) {
        console.error('Error eliminando pago:', err);
        res.status(500).json({ error: 'Error eliminando pago' });
    }
};

// =====================================================================
// 9. OBTENER TOTAL GENERAL PAGADO
// =====================================================================
export const getTotalPagosByStudentIdController = async (req, res) => {
    const { student_id } = req.params;
    try {
        const query = `SELECT SUM(monto) as total FROM pagos WHERE student_id = $1 AND estado = 'Pagado'`;
        const { rows } = await pool.query(query, [student_id]);
        res.status(200).json({ total_pagado: rows[0].total || 0 });
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo total' });
    }
};

// =====================================================================
// 10. OBTENER PAGO POR ID
// =====================================================================
export const getPagosByIdController = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM pagos WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
        res.status(200).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo pago' });
    }
};