import pool from '../database.js';

// ==========================================
// 1. CREAR ÍTEM (CREATE)
// ==========================================
export const createInventarioItem = async (req, res) => {
    try {
        const { nombre, monto, descripcion } = req.body;
        const usuarioId = req.user?.id; // Obtenemos el ID del token

        // Validaciones
        if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });
        if (!nombre || !monto) {
            return res.status(400).json({ message: 'Nombre y monto son obligatorios.' });
        }

        // Query SQL
        // Asumo que la tabla se llama 'inventario' y la columna de usuario es 'user_id' o 'usuario'
        // Ajusta 'user_id' si tu columna se llama 'usuario' como en ingresos
        const query = `
            INSERT INTO inventario (nombre, monto, descripcion, user_id, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *;
        `;

        const values = [nombre, monto, descripcion || '', usuarioId];
        
        const result = await pool.query(query, values);

        return res.status(201).json({
            message: 'Ítem creado exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error al crear item:', error);
        if (error.code === '23505') { // Código de error de duplicado en Postgres
            return res.status(409).json({ message: `El producto "${req.body.nombre}" ya existe.` });
        }
        return res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
};

// ==========================================
// 2. OBTENER TODOS LOS ÍTEMS DEL USUARIO (READ)
// ==========================================
export const getInventario = async (req, res) => {
    try {
        const usuarioId = req.user?.id;
        
        if (!usuarioId) return res.status(401).json({ message: "Usuario no autenticado" });

        const query = `
            SELECT * FROM inventario 
            WHERE user_id = $1 
            ORDER BY id DESC
        `;
        
        const result = await pool.query(query, [usuarioId]);
        
        // Retornamos el array directo para que el frontend lo consuma fácil
        return res.status(200).json(result.rows);

    } catch (error) {
        console.error("Error obteniendo inventario:", error);
        return res.status(500).json({ message: "Error al obtener inventario" });
    }
};

// ==========================================
// 3. ACTUALIZAR ÍTEM (UPDATE)
// ==========================================
export const updateInventarioItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, monto, descripcion } = req.body;
        const usuarioId = req.user?.id;

        // Validamos que el ítem pertenezca al usuario antes de editar
        const checkQuery = `SELECT * FROM inventario WHERE id = $1 AND user_id = $2`;
        const checkResult = await pool.query(checkQuery, [id, usuarioId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: "Ítem no encontrado o no autorizado" });
        }

        const updateQuery = `
            UPDATE inventario 
            SET nombre = $1, monto = $2, descripcion = $3 
            WHERE id = $4 
            RETURNING *;
        `;
        
        const result = await pool.query(updateQuery, [nombre, monto, descripcion, id]);

        return res.status(200).json({
            message: 'Ítem actualizado',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error actualizando:', error);
        return res.status(500).json({ message: 'Error al actualizar el ítem' });
    }
};

// ==========================================
// 4. ELIMINAR ÍTEM (DELETE)
// ==========================================
export const deleteInventarioItem = async (req, res) => {
    try {
        // Aceptamos borrar uno (params) o varios (body) para flexibilidad
        const { id } = req.params; 
        const { ids } = req.body; // Opción para borrar en lote si lo necesitas
        const usuarioId = req.user?.id;

        if (ids && Array.isArray(ids)) {
            // Borrado múltiple
            const query = `DELETE FROM inventario WHERE id = ANY($1) AND user_id = $2 RETURNING *`;
            const result = await pool.query(query, [ids, usuarioId]);
            return res.status(200).json({ message: `${result.rowCount} ítems eliminados.` });
        } else if (id) {
            // Borrado individual
            const query = `DELETE FROM inventario WHERE id = $1 AND user_id = $2 RETURNING *`;
            const result = await pool.query(query, [id, usuarioId]);
            
            if (result.rowCount === 0) {
                return res.status(404).json({ message: "Ítem no encontrado o no autorizado" });
            }
            return res.status(200).json({ message: "Ítem eliminado correctamente" });
        } else {
            return res.status(400).json({ message: "Se requiere ID para eliminar" });
        }

    } catch (error) {
        console.error('Error eliminando:', error);
        return res.status(500).json({ message: 'Error al eliminar' });
    }
};

// ==========================================
// 5. OBTENER POR UN USUARIO ESPECÍFICO (ADMIN)
// ==========================================
export const getInventarioByUserId = async (req, res) => {
    const { userId } = req.params;
    try {
        const query = `SELECT * FROM inventario WHERE user_id = $1`;
        const result = await pool.query(query, [userId]);
        return res.status(200).json(result.rows);
    } catch (error) {
        return res.status(500).json({ message: "Error al consultar usuario específico" });
    }
};