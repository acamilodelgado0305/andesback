// src/controllers/inventarioController.js
import {
  createInventarioItem,
  getInventarioItems,
  getInventarioItemById,
  updateInventarioItem,
  deleteInventarioItem,
  getInventarioItemsByUserId 
} from '../models/inventarioModel.js';

// Crear un nuevo item de inventario para el usuario autenticado
const createInventarioController = async (req, res) => {
  const { nombre, monto, descripcion } = req.body; // Incluir descripcion
  const user_id = req.userId; // Obtener el ID del usuario autenticado desde el middleware (asumiendo que verifyToken lo añade)

  // Validar si el usuario está autenticado
  if (!user_id) {
    return res.status(401).json({ error: 'Acceso denegado. No autenticado.' });
  }
  // Validar campos requeridos
  if (!nombre || !monto) {
    return res.status(400).json({ error: 'Nombre y monto son requeridos.' });
  }

  try {
    const inventarioItem = await createInventarioItem(nombre, monto, descripcion, user_id);
    res.status(201).json(inventarioItem);
  } catch (err) {
    console.error('Error creando item de inventario:', err);
    res.status(500).json({ error: 'Error interno del servidor al crear item de inventario.' });
  }
};

// Obtener los items de inventario del usuario autenticado
const getInventarioController = async (req, res) => {
  const user_id = req.userId; // Obtener el ID del usuario autenticado

  if (!user_id) {
    return res.status(401).json({ error: 'Acceso denegado. No autenticado.' });
  }

  try {
    const inventarioItems = await getInventarioItems(user_id); // Obtener solo los ítems de este usuario
    res.status(200).json(inventarioItems);
  } catch (err) {
    console.error('Error obteniendo items de inventario:', err);
    res.status(500).json({ error: 'Error interno del servidor al obtener items de inventario.' });
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
  const { id } = req.params;
  const { nombre, monto, descripcion } = req.body; // Incluir descripcion
  const user_id = req.userId; // Obtener el ID del usuario autenticado

  if (!user_id) {
    return res.status(401).json({ error: 'Acceso denegado. No autenticado.' });
  }
  if (!nombre || !monto) {
    return res.status(400).json({ error: 'Nombre y monto son requeridos para la actualización.' });
  }

  try {
    const existingItem = await getInventarioItemById(id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Item de inventario no encontrado.' });
    }

    // Asegurarse de que el usuario solo pueda actualizar sus propios ítems (y no los maestros)
    if (existingItem.user_id !== user_id) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para actualizar este item.' });
    }
    if (existingItem.user_id === null) { // Prevenir que un usuario normal modifique un ítem maestro
        return res.status(403).json({ error: 'Acceso denegado: no puedes actualizar ítems maestros.' });
    }


    const inventarioItem = await updateInventarioItem(id, nombre, monto, descripcion);
    res.status(200).json(inventarioItem);
  } catch (err) {
    console.error('Error actualizando item de inventario:', err);
    res.status(500).json({ error: 'Error interno del servidor al actualizar item de inventario.' });
  }
};

// Eliminar un item de inventario (con validación de pertenencia)
const deleteInventarioController = async (req, res) => {
  const { id } = req.params;
  const user_id = req.userId; // Obtener el ID del usuario autenticado

  if (!user_id) {
    return res.status(401).json({ error: 'Acceso denegado. No autenticado.' });
  }

  try {
    const existingItem = await getInventarioItemById(id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Item de inventario no encontrado.' });
    }

    // Asegurarse de que el usuario solo pueda eliminar sus propios ítems (y no los maestros)
    if (existingItem.user_id !== user_id) {
      return res.status(403).json({ error: 'Acceso denegado: no tienes permiso para eliminar este item.' });
    }
    if (existingItem.user_id === null) { // Prevenir que un usuario normal elimine un ítem maestro
        return res.status(403).json({ error: 'Acceso denegado: no puedes eliminar ítems maestros.' });
    }

    const inventarioItem = await deleteInventarioItem(id);
    res.status(200).json(inventarioItem);
  } catch (err) {
    console.error('Error eliminando item de inventario:', err);
    res.status(500).json({ error: 'Error interno del servidor al eliminar item de inventario.' });
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
  getInventarioController,
  getInventarioByIdController,
  updateInventarioController,
  deleteInventarioController,
  getInventarioBySpecificUserController
};