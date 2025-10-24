// src/api.js
const API_URL = import.meta.env.VITE_API_URL || "https://perimeter-prototype.onrender.com";

/**
 * 🔹 Envía una posición al backend
 * @param {object} pos - { device_id: string, lat: number, lon: number }
 * @returns {Promise<object>}
 */
export const enviarPosicion = async (pos) => {
  try {
    const res = await fetch(`${API_URL}/pos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // este endpoint no requiere JWT
      body: JSON.stringify(pos),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Error al enviar posición");
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error enviarPosicion:", err);
    return { estado: "Error al enviar posición" };
  }
};

/**
 * 🔹 Obtiene la geocerca del usuario autenticado
 * @param {string} token - JWT RS256 del usuario
 * @returns {Promise<object|null>}
 */
export const obtenerGeocerca = async (token) => {
  if (!token) {
    console.warn("[API] obtenerGeocerca: sin token JWT");
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/get_geofence`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`, // header obligatorio para RS256
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Error al obtener geocerca");
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error obtenerGeocerca:", err);
    return null;
  }
};

/**
 * 🔹 Guarda una geocerca del usuario autenticado
 * @param {object} geojson - Objeto con geometry (GeoJSON)
 * @param {string} token - JWT RS256 del usuario
 * @returns {Promise<object>}
 */
export const guardarGeocerca = async (geojson, token) => {
  if (!token) {
    console.warn("[API] guardarGeocerca: sin token JWT");
    return { success: false, message: "Usuario no autenticado" };
  }

  try {
    const res = await fetch(`${API_URL}/set_geofence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // header obligatorio para RS256
      },
      body: JSON.stringify(geojson),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Error al guardar geocerca");
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error guardarGeocerca:", err);
    return { success: false, message: "Error al guardar geocerca" };
  }
};


