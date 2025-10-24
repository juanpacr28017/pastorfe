// src/api.js
const API_URL = import.meta.env.VITE_API_URL || "https://perimeter-prototype.onrender.com";

/**
 * Envía una posición al backend
 * pos = { device_id: string, lat: number, lon: number }
 */
export const enviarPosicion = async (pos) => {
  try {
    const res = await fetch(`${API_URL}/pos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pos),
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (err) {
    console.error("[API] Error enviarPosicion:", err);
    return { estado: "Error al enviar posición" };
  }
};

/**
 * Obtiene la geocerca del usuario autenticado
 * @param {string} token - JWT del usuario (supabase.auth.getSession().data.session.access_token)
 */
export const obtenerGeocerca = async (token) => {
  try {
    const res = await fetch(`${API_URL}/get_geofence`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (err) {
    console.error("[API] Error obtenerGeocerca:", err);
    return null;
  }
};

/**
 * Guarda una geocerca del usuario autenticado
 * @param {object} geojson - GeoJSON geometry
 * @param {string} token - JWT del usuario
 */
export const guardarGeocerca = async (geojson, token) => {
  try {
    const res = await fetch(`${API_URL}/set_geofence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(geojson),
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (err) {
    console.error("[API] Error guardarGeocerca:", err);
    return { success: false, message: "Error al guardar geocerca" };
  }
};
