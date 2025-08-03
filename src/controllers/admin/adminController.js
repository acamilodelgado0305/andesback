import pool from '../../database.js';
import dayjs from 'dayjs';

// Obtiene TODOS los clientes y su estado de suscripción MÁS RECIENTE
export const getAllClientsController = async (req, res) => {
    try {
        // Este query usa DISTINCT ON para obtener solo la última suscripción de cada usuario
        const query = `
            SELECT DISTINCT ON (u.id)
                u.id,
                u.name,
                u.email,
                s.plan_name,
                s.end_date,
                s.amount_paid,
                s.start_date,
                CASE 
                    WHEN s.end_date >= CURRENT_DATE THEN 'active'
                    ELSE 'expired'
                END AS subscription_status
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            ORDER BY u.id, s.start_date DESC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener clientes:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// Obtiene el historial COMPLETO de suscripciones de UN SOLO cliente
export const getClientDetailsController = async (req, res) => {
    const { userId } = req.params;
    try {
        const userQuery = 'SELECT id, name, email FROM users WHERE id = $1';
        const userResult = await pool.query(userQuery, [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado.' });
        }
        
        const historyQuery = 'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY start_date DESC';
        const historyResult = await pool.query(historyQuery, [userId]);
        
        res.status(200).json({
            ...userResult.rows[0],
            subscription_history: historyResult.rows
        });
    } catch (err) {
        console.error('Error al obtener detalles:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// Crea un NUEVO registro de suscripción (para nuevos clientes o renovaciones)
export const createSubscriptionController = async (req, res) => {
    const { userId, planName, amountPaid, durationMonths, description } = req.body;

    if (!userId || !planName || !amountPaid || !durationMonths) {
        return res.status(400).json({ error: 'Faltan datos.' });
    }

    const startDate = dayjs();
    const endDate = startDate.add(durationMonths, 'month');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        // Pone todas las suscripciones viejas de este usuario como 'expired'
        await client.query("UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'", [userId]);

        const query = `
            INSERT INTO subscriptions (user_id, plan_name, amount_paid, duration_months, description, start_date, end_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
            RETURNING *;
        `;
        const result = await client.query(query, [userId, planName, amountPaid, durationMonths, description, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]);
        
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear suscripción:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
};

// Nuevo endpoint: getSubscriptionExpirationController
export const getSubscriptionExpirationController = async (req, res) => {
    try {
        const userId = req.params.userId; // Usa el parámetro de la ruta en lugar de req.user
        const query = `
            SELECT end_date, amount_paid
            FROM subscriptions
            WHERE user_id = $1
            ORDER BY end_date DESC
            LIMIT 1;
        `;
        const result = await pool.query(query, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró una suscripción para este usuario.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener fecha de vencimiento:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};