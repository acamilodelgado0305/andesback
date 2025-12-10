// src/models/inventarioModel.js
import pool from '../database.js';
import {
  createInventarioItem,
  getInventarioItems,
  getInventarioItemById,
  updateInventarioItem,
  deleteInventarioItemsByIds,
  getInventarioItemsByUserId 
} from '../models/inventarioModel.js';

// Crear un nuevo item de inventario para el usuario autenticado
const createInventarioController = async (req, res) => {
  // 1. Obtenemos todos los datos necesarios desde el body de la petición
  const { nombre, monto, descripcion, user_id } = req.body;

  // 2. Validación robusta de los datos de entrada
  if (!nombre || !monto || !user_id) {
    return res.status(400).json({ 
        message: 'Los campos nombre, monto y user_id son obligatorios.' 
    });
  }
  
  // Validamos que el monto y user_id sean números
  if (isNaN(monto) || isNaN(user_id)) {
    return res.status(400).json({
        message: 'El monto y el user_id deben ser valores numéricos.'
    });
  }

  try {
    // 3. Llamamos al modelo para crear el ítem en la base de datos
    const nuevoItem = await createInventarioItem(nombre, monto, descripcion, user_id);
    res.status(201).json({
        message: 'Ítem de inventario creado exitosamente.',
        data: nuevoItem
    });

  } catch (err) {
    // 4. Manejo de errores mejorado
    console.error('Error al crear item de inventario:', err.message);

    // Error específico para violación de la restricción UNIQUE de PostgreSQL (código '23505')
    if (err.code === '23505') {
      return res.status(409).json({ // 409 Conflict es más apropiado aquí
        message: `El ítem con el nombre "${nombre}" ya existe en el inventario para este usuario.`
      });
    }

    // Error genérico del servidor
    res.status(500).json({ 
        message: 'Error interno del servidor al crear el ítem de inventario.' 
    });
  }
};

// Obtener los items de inventario del usuario autenticado
export const getInventarioController = async (req, res) => {
  try {
    // Datos del usuario autenticado desde el middleware
    const userId = req.user?.id; // viene de decoded.sub

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const query = `
      SELECT *
      FROM inventario
      WHERE user_id = $1
      ORDER BY id DESC
    `;
    const params = [userId];

    const result = await pool.query(query, params);

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error obteniendo items de inventario:", err);
    return res.status(500).json({
      message: "Error interno del servidor al obtener el inventario",
    });
  }
};

// Obtener un item de inventario por su ID (con validación de pertenencia)
const getInventarioByIdController = async (req, res) => {
  const { id } = req.params;
  const user_id = req.userId; // Obtener el ID del usuario autenticado

  if (!user_id) {
    return res.status(401).json({ error: 'Acceso denegado. No autenticado.' });
  }

  try {
    const inventarioItem = await getInventarioItemById(id);
    if (!inventarioItem) {
      return res.status(404).json({ error: 'Item de inventario no encontrado.' });
    }

    // Asegurarse de que el usuario solo pueda acceder a sus propios ítems
    // Opcional: Si quieres que los usuarios puedan ver los ítems "maestros" (user_id IS NULL) también:
    // if (inventarioItem.user_id !== user_id && inventarioItem.user_id !== null) {
    if (inventarioItem.user_id !== user_id) { // Solo permite acceder a ítems propios
      return res.status(403).json({ error: 'Acceso denegado: este item no pertenece a tu usuario.' });
    }

    res.status(200).json(inventarioItem);
  } catch (err) {
    console.error('Error obteniendo item de inventario por ID:', err);
    res.status(500).json({ error: 'Error interno del servidor al obtener item de inventario.' });
  }
};

// Actualizar un item de inventario (con validación de pertenencia)
const updateInventarioController = async (req, res) => {
  // Obtenemos el ID del ítem desde los parámetros de la URL
  const { id } = req.params;
  // Obtenemos los datos a actualizar desde el cuerpo de la petición
  const { nombre, monto, descripcion } = req.body;
  // Obtenemos el ID del usuario desde el token (middleware verifyToken)


  // --- Validación ---
  if (!nombre || monto === undefined) {
    return res.status(400).json({ message: 'El nombre y el monto son requeridos para la actualización.' });
  }
  if (isNaN(monto) || monto < 0) {
    return res.status(400).json({ message: 'El monto debe ser un número positivo.' });
  }

  try {
    // 1. Verificar que el ítem existe
    const existingItem = await getInventarioItemById(id);
    if (!existingItem) {
      return res.status(404).json({ message: 'El ítem de inventario que intentas actualizar no fue encontrado.' });
    }

    // 2. Verificar autorización: El usuario autenticado debe ser el dueño del ítem

    
    // 3. Proceder con la actualización
    const inventarioItem = await updateInventarioItem(id, nombre, monto, descripcion);
    res.status(200).json({
      message: 'Ítem actualizado exitosamente.',
      data: inventarioItem
    });

  } catch (err) {
    console.error('Error actualizando item de inventario:', err.message);

    // Error específico para violación de la restricción UNIQUE (si cambia el nombre a uno que ya existe)
    if (err.code === '23505') {
      return res.status(409).json({ // 409 Conflict
        message: `Ya tienes otro ítem con el nombre "${nombre}".`
      });
    }

    // Error genérico del servidor
    res.status(500).json({ message: 'Error interno del servidor al actualizar el ítem.' });
  }
};

// Eliminar un item de inventario (con validación de pertenencia)
const deleteInventarioController = async (req, res) => {
  // 1. Obtenemos el array de IDs desde el cuerpo de la petición
  const { ids } = req.body;


  // 2. Validación de la entrada
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'Se requiere un array de IDs para la eliminación.' });
  }

  try {
    // 3. Llamamos a la nueva función del modelo para eliminar
    // Esta función se encargará de la lógica de negocio y seguridad internamente
    const deletedCount = await deleteInventarioItemsByIds(ids);

    if (deletedCount === 0) {
      // Esto puede pasar si los IDs no existían o no pertenecían al usuario
      return res.status(404).json({ message: 'No se eliminó ningún ítem. Verifique los IDs y la propiedad de los mismos.' });
    }

    res.status(200).json({
      message: `${deletedCount} ítem(s) de inventario eliminado(s) exitosamente.`
    });

  } catch (err) {
    console.error('Error eliminando ítems de inventario:', err.message);
    res.status(500).json({ message: 'Error interno del servidor al eliminar los ítems.' });
  }
};

const getInventarioBySpecificUserController = async (req, res) => {
  const { userId } = req.params; // Obtener el userId de los parámetros de la URL

  // Validar que el userId proporcionado sea un número válido
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'ID de usuario inválido.' });
  }

  try {
    // La llamada a getInventarioItemsByUserId
    const inventarioItems = await getInventarioItemsByUserId(parseInt(userId, 10));
    if (inventarioItems.length === 0) {
      return res.status(404).json({ message: 'No se encontró inventario para el usuario especificado o el usuario no existe.' });
    }
    res.status(200).json(inventarioItems);
  } catch (err) {
    console.error('Error obteniendo inventario por ID de usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor al obtener inventario por ID de usuario.' });
  }
};


export {
  createInventarioController,
  getInventarioByIdController,
  updateInventarioController,
  deleteInventarioController,
  getInventarioBySpecificUserController
};