// src/api.js
const API_URL = import.meta.env.VITE_API_URL || "https://perimeter-prototype.onrender.com";

/**
 * Envía una posición al backend
 * pos = { device_id: string, lat: number, lon: number, user_id?: string }
 */
export async function enviarPosicion(pos) {
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
}

/**
 * Obtiene la geocerca del usuario
 */
export async function obtenerGeocerca(user_id = "default_user") {
  try {
    const res = await fetch(`${API_URL}/get_geofence?user_id=${user_id}`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (err) {
    console.error("[API] Error obtenerGeocerca:", err);
    return null;
  }
}

/**
 * Guarda una geocerca del usuario
 */
export async function guardarGeocerca(geojson, user_id = "default_user") {
  try {
    // Se envía el geojson con user_id
    const body = JSON.stringify({ ...geojson, user_id });

    const res = await fetch(`${API_URL}/set_geofence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (err) {
    console.error("[API] Error guardarGeocerca:", err);
    return { success: false, message: "Error al guardar geocerca" };
  }
}
