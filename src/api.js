// src/api.js
const API_URL = import.meta.env.VITE_API_URL || "https://perimeter-prototype.onrender.com";

/**
 * Envía una posición al backend
 * pos = { device_id: string, lat: number, lon: number, user_id?: string }
 */
export const enviarPosicion = async (pos) => {
  try {
    const res = await fetch(`${API_URL}/pos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pos),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error enviarPosicion:", err);
    return { estado: "Error al enviar posición" };
  }
};

/**
 * Obtiene la geocerca de un usuario
 * @param {string} user_id - ID del usuario
 */
export const obtenerGeocerca = async (user_id = "default_user") => {
  try {
    const res = await fetch(`${API_URL}/get_geofence?user_id=${user_id}`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }
    return await res.json();
  } catch (err) {
    console.error("[API] Error obtenerGeocerca:", err);
    return null;
  }
};

/**
 * Guarda una geocerca para un usuario
 * @param {object} geojson - GeoJSON geometry { type: "Polygon", coordinates: [...] }
 * @param {string} user_id - ID del usuario
 */
export const guardarGeocerca = async (geojson, user_id = "default_user") => {
  try {
    // Validar que sea un GeoJSON correcto
    if (!geojson?.type || !geojson?.coordinates) {
      throw new Error("GeoJSON inválido");
    }

    const body = {
      type: geojson.type,
      coordinates: geojson.coordinates,
      user_id,
      name: "default_geofence", // Nombre opcional
    };

    const res = await fetch(`${API_URL}/set_geofence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText);
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error guardarGeocerca:", err);
    return { success: false, message: "Error al guardar geocerca" };
  }
};
