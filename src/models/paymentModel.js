// models/paymentModel.js
import pool from '../database.js'; // Asegúrate de que esta ruta sea correcta para tu pool de conexión

// Función para crear un nuevo pago
export const createPago = async (student_id, tipo_pago_id, monto, periodo_pagado, metodo_pago, referencia_transaccion, estado, observaciones) => {
    const query = `
        INSERT INTO pagos (student_id, tipo_pago_id, monto, fecha_pago, periodo_pagado, metodo_pago, referencia_transaccion, estado, observaciones)
        VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8)
        RETURNING *;
    `;
    const values = [student_id, tipo_pago_id, monto, periodo_pagado, metodo_pago, referencia_transaccion, estado, observaciones];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Función para obtener todos los pagos
export const getPagos = async () => {
    const query = `
        SELECT p.*, s.nombre AS student_nombre, s.apellido AS student_apellido, tp.nombre AS tipo_pago_nombre
        FROM pagos p
        JOIN students s ON p.student_id = s.id
        JOIN tipos_pago tp ON p.tipo_pago_id = tp.id
        ORDER BY p.fecha_pago DESC, p.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
};

// Función para obtener un pago por su ID
export const getPagosById = async (id) => {
    const query = `
        SELECT p.*, s.nombre AS student_nombre, s.apellido AS student_apellido, tp.nombre AS tipo_pago_nombre
        FROM pagos p
        JOIN students s ON p.student_id = s.id
        JOIN tipos_pago tp ON p.tipo_pago_id = tp.id
        WHERE p.id = $1;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
};

// Función para obtener pagos por ID de estudiante
export const getPagosByStudentId = async (student_id) => {
    const query = `
        SELECT p.*, tp.nombre AS tipo_pago_nombre
        FROM pagos p
        JOIN tipos_pago tp ON p.tipo_pago_id = tp.id
        WHERE p.student_id = $1
        ORDER BY p.fecha_pago DESC, p.created_at DESC;
    `;
    const { rows } = await pool.query(query, [student_id]);
    return rows;
};

// Función para actualizar un pago
export const updatePago = async (id, student_id, tipo_pago_id, monto, fecha_pago, periodo_pagado, metodo_pago, referencia_transaccion, estado, observaciones) => {
    const query = `
        UPDATE pagos
        SET student_id = $1, tipo_pago_id = $2, monto = $3, fecha_pago = $4,
            periodo_pagado = $5, metodo_pago = $6, referencia_transaccion = $7,
            estado = $8, observaciones = $9, updated_at = NOW()
        WHERE id = $10
        RETURNING *;
    `;
    const values = [student_id, tipo_pago_id, monto, fecha_pago, periodo_pagado, metodo_pago, referencia_transaccion, estado, observaciones, id];
    const { rows } = await pool.query(query, values);
    return rows[0];
};

// Función para actualizar solo el estado de un pago
export const updateEstadoPago = async (id, estado) => {
    const query = `
        UPDATE pagos
        SET estado = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [estado, id]);
    return rows[0];
};

// Función para eliminar un pago
export const deletePago = async (id) => {
    const query = `
        DELETE FROM pagos
        WHERE id = $1
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [id]);
    return rows[0];
};

// Función para obtener el total de pagos (solo con estado 'Pagado') de un estudiante
export const getPagosTotalByStudentId = async (student_id) => {
    const query = `
        SELECT COALESCE(SUM(monto), 0) AS total_pagado
        FROM pagos
        WHERE student_id = $1 AND estado = 'Pagado';
    `;
    const { rows } = await pool.query(query, [student_id]);
    return parseFloat(rows[0].total_pagado);
};

// Función para verificar la mensualidad (se puede usar en el controlador directamente o aquí)
// export const verificarMensualidad = async (student_id, periodo) => {
//     const tipoMensualidad = await pool.query('SELECT id FROM tipos_pago WHERE nombre = $1', ['Mensualidad']);
//     if (tipoMensualidad.rows.length === 0) {
//         throw new Error('Tipo de pago "Mensualidad" no encontrado.');
//     }
//     const tipo_pago_id = tipoMensualidad.rows[0].id;

//     const query = `
//         SELECT * FROM pagos
//         WHERE student_id = $1
//         AND tipo_pago_id = $2
//         AND periodo_pagado = $3
//         AND estado = 'Pagado';
//     `;
//     const { rows } = await pool.query(query, [student_id, tipo_pago_id, periodo]);
//     return rows.length > 0; // Retorna true si hay un pago, false si no
// };