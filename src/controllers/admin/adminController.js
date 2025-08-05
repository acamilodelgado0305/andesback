import pool from '../../database.js';
import dayjs from 'dayjs';

// Obtiene TODOS los clientes y su estado de suscripción MÁS RECIENTE
/**
 * @description Obtiene una lista de todos los usuarios con el estado de su última suscripción y plan asociado.
 * @name getSubscriptionsOverviewController
 */
// En adminController.js

/**
 * @description Obtiene una lista de todos los usuarios con el estado de su última suscripción, 
 * el plan asociado y el total histórico pagado.
 * @name getSubscriptionsOverviewController
 */
export const getSubscriptionsOverviewController = async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT ON (u.id)
                u.id,
                u.name,
                u.email,
                p.name AS plan_name,
                s.end_date,
                s.amount_paid, -- Monto del último pago
                s.start_date,
                -- NUEVO: Subconsulta para sumar todos los pagos del usuario
                (
                    SELECT SUM(s_sum.amount_paid)
                    FROM subscriptions s_sum
                    WHERE s_sum.user_id = u.id
                ) AS total_paid,
                CASE 
                    WHEN s.id IS NULL THEN 'no_subscription'
                    WHEN s.end_date >= CURRENT_DATE THEN 'active'
                    ELSE 'expired'
                END AS subscription_status
            FROM users u
            LEFT JOIN subscriptions s ON u.id = s.user_id
            LEFT JOIN plans p ON s.plan_id = p.id
            ORDER BY u.id, s.start_date DESC;
        `;
        const result = await pool.query(query);
        // Devolvemos las filas con el nuevo campo 'total_paid'
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener el resumen de suscripciones:', err);
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

// Renueva una suscripción existente para un usuario
// Renueva una suscripción existente para un usuario (VERSIÓN CORREGIDA)
/**
 * @description Renueva o crea una suscripción para un usuario basándose en un plan existente.
 * @name renewSubscriptionController
 */
export const renewSubscriptionController = async (req, res) => {
    // CAMBIO: La entrada ahora es mucho más simple. Solo necesitamos saber QUIÉN y QUÉ PLAN.
    const { userId, planId, description } = req.body;

    // CAMBIO: La validación ahora comprueba 'planId'.
    if (!userId || !planId) {
        return res.status(400).json({ error: 'Faltan datos para la renovación. Se requiere userId y planId.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // PASO 1 (NUEVO): Obtener los detalles del plan desde la base de datos.
        // Esta es la fuente única de verdad para el precio y la duración.
        const planResult = await client.query('SELECT * FROM plans WHERE id = $1 AND is_active = TRUE', [planId]);

        if (planResult.rows.length === 0) {
            // Si el plan no existe o está inactivo, no continuamos.
            await client.query('ROLLBACK'); // Importante deshacer la transacción
            return res.status(404).json({ error: 'Plan no encontrado o está inactivo.' });
        }
        const plan = planResult.rows[0]; // Aquí tenemos el precio y la duración correctos.

        // PASO 2: Obtener la última suscripción del usuario para saber dónde continuar.
        const lastSubResult = await client.query('SELECT end_date FROM subscriptions WHERE user_id = $1 ORDER BY end_date DESC LIMIT 1', [userId]);

        const today = dayjs();
        let startDate;

        if (lastSubResult.rows.length > 0) {
            const lastEndDate = dayjs(lastSubResult.rows[0].end_date);
            // La nueva suscripción empieza cuando termina la anterior, o hoy si ya expiró.
            startDate = lastEndDate.isBefore(today) ? today : lastEndDate.add(1, 'day');
        } else {
            // Si el usuario nunca ha tenido una suscripción, empieza hoy.
            startDate = today;
        }

        // CAMBIO: La fecha de fin se calcula con la duración obtenida del plan.
        const endDate = startDate.add(plan.duration_months, 'month');

        // ELIMINADO: Ya no actualizamos manualmente el estado de la suscripción anterior a 'expired'.
        // El estado ('active'/'expired') se debe determinar de forma dinámica basado en la fecha de fin (end_date),
        // como lo hicimos en `getSubscriptionsOverviewController`. Esto evita marcar erróneamente una suscripción
        // como expirada antes de tiempo.
        // await client.query("UPDATE subscriptions SET status = 'expired' ... ");

        // PASO 3 (NUEVO): La consulta de inserción ahora usa 'plan_id'.
        const insertQuery = `
            INSERT INTO subscriptions (user_id, plan_id, amount_paid, start_date, end_date, description, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'active')
            RETURNING *;
        `;

        // CAMBIO: Los valores vienen de nuestras variables y del objeto 'plan' que consultamos.
        const result = await client.query(insertQuery, [
            userId,
            plan.id,        // o planId
            plan.price,     // El precio real, desde la BD
            startDate.format('YYYY-MM-DD'),
            endDate.format('YYYY-MM-DD'),
            description
        ]);
        
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al renovar la suscripción:', err);
        res.status(500).json({ error: 'Error interno del servidor al renovar la suscripción.' });
    } finally {
        client.release();
    }
};


// Añade esta función a tu adminController.js

/**
 * @description Obtiene todos los planes de suscripción activos.
 * @name getPlansController
 */
export const getPlansController = async (req, res) => {
    try {
        // Obtenemos solo los planes activos y los ordenamos por nombre
        const query = "SELECT id, name, price, duration_months FROM plans WHERE is_active = TRUE ORDER BY name";
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener los planes:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};