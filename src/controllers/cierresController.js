import pool from '../database.js';

export const getCierresByProgramaController = async (req, res) => {
    const { programaId } = req.params;
    const businessId = req.user?.bid;

    try {
        const { rows } = await pool.query(
            `SELECT * FROM cierres
             WHERE programa_id = $1 AND (business_id = $2 OR business_id IS NULL)
             ORDER BY created_at ASC`,
            [programaId, businessId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error obteniendo cierres:', err);
        res.status(500).json({ error: 'Error obteniendo cierres' });
    }
};

export const createCierreController = async (req, res) => {
    const { nombre, programa_id } = req.body;
    const businessId = req.user?.bid;

    if (!nombre?.trim() || !programa_id) {
        return res.status(400).json({ error: 'nombre y programa_id son requeridos' });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO cierres (nombre, programa_id, business_id)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [nombre.trim(), programa_id, businessId]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creando cierre:', err);
        res.status(500).json({ error: 'Error creando cierre' });
    }
};

export const cerrarCierreController = async (req, res) => {
    const { id } = req.params;
    const businessId = req.user?.bid;

    try {
        const { rows } = await pool.query(
            `UPDATE cierres
             SET cerrado = true, fecha_cierre = NOW()
             WHERE id = $1
               AND (business_id = $2 OR business_id IS NULL)
               AND cerrado = false
             RETURNING *`,
            [id, businessId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cierre no encontrado o ya está cerrado' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Error cerrando cierre:', err);
        res.status(500).json({ error: 'Error cerrando cierre' });
    }
};

export const deleteCierreController = async (req, res) => {
    const { id } = req.params;
    const businessId = req.user?.bid;

    try {
        const { rows } = await pool.query(
            `DELETE FROM cierres
             WHERE id = $1
               AND (business_id = $2 OR business_id IS NULL)
               AND cerrado = false
             RETURNING *`,
            [id, businessId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cierre no encontrado o ya está cerrado' });
        }

        res.json({ message: 'Cierre eliminado' });
    } catch (err) {
        console.error('Error eliminando cierre:', err);
        res.status(500).json({ error: 'Error eliminando cierre' });
    }
};
