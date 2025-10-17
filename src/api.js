// src/api.js
const API_URL = import.meta.env.VITE_API_URL || "https://perimeter-prototype.onrender.com";

/**
 * Envía una posición al backend FastAPI
 * pos = { device_id: string, lat: number, lon: number }
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
      throw new Error(`Error al enviar posición: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error enviarPosicion:", err);
    return { estado: "Error al enviar posición" };
  }
};

/**
 * Obtiene la geocerca desde el backend
 */
export const obtenerGeocerca = async () => {
  try {
    const res = await fetch(`${API_URL}/get_geofence`);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error al obtener geocerca: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error obtenerGeocerca:", err);
    return null; // Devuelve null si hay un error, para que App.jsx lo gestione
  }
};

/**
 * Guarda una geocerca nueva en el backend
 * geojson = GeoJSON geometry
 */
export const guardarGeocerca = async (geojson) => {
  try {
    const res = await fetch(`${API_URL}/set_geofence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geojson),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error al guardar geocerca: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error("[API] Error guardarGeocerca:", err);
    return { success: false, message: "Error al guardar geocerca" };
  }
};

