// src/services/authServiceClient.js
// Cliente para comunicarse con el microservicio de autenticación

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

/**
 * Obtiene todos los usuarios del business activo desde el auth-service.
 * Devuelve un Map { userId -> userName } para lookups O(1).
 *
 * @param {string} token  - Bearer token del request original
 * @returns {Promise<Map<number, string>>}
 */
export const getUsersMapFromAuthService = async (token) => {
  try {
    const response = await fetch(
      `${AUTH_SERVICE_URL}/api/businesses/my/users`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`[authServiceClient] Error obteniendo usuarios: ${response.status}`);
      return new Map();
    }

    const users = await response.json();

    // Construye un mapa id → name para lookup rápido
    const map = new Map();
    if (Array.isArray(users)) {
      users.forEach((u) => {
        if (u.id != null) map.set(Number(u.id), u.name || u.email || `Usuario ${u.id}`);
      });
    }

    return map;
  } catch (err) {
    console.error('[authServiceClient] Error conectando con auth-service:', err.message);
    return new Map();
  }
};
