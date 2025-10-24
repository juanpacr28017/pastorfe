// src/api.js
const API_URL = import.meta.env.VITE_BACKEND_URL || "https://perimeter-prototype.onrender.com";

/**
 * 🔐 Login o registro de usuario (el backend decide)
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{ token: string } | { error: string }>}
 */
export const autenticarUsuario = async (email, password) => {
  try {
    const res = await fetch(`${API_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al autenticar");

    const token = data.access_token || data.access?.token;
    if (!token) throw new Error("No se recibió token del backend");

    return { token };
  } catch (err) {
    console.error("[API] Error autenticarUsuario:", err);
    return { error: err.message };
  }
};

/**
 * 📍 Envía una posición (sin autenticación)
 * @param {object} pos - { device_id: string, lat: number, lon: number }
 * @returns {Promise<object>}
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
      throw new Error(errorText || "Error al enviar posición");
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error enviarPosicion:", err);
    return { estado: "Error al enviar posición" };
  }
};

/**
 * 🧭 Obtiene la geocerca del usuario autenticado
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
      headers: { Authorization: `Bearer ${token}` },
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
 * 💾 Guarda una geocerca nueva
 * @param {object} geojson - Objeto GeoJSON { type: "Polygon", coordinates: [...] }
 * @param {string} token - JWT RS256
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
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ geometry: geojson }),
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
