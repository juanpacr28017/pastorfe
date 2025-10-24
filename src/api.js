// src/api.js
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * 🔹 Envía una posición al backend
 * @param {object} pos - { device_id: string, lat: number, lon: number }
 * @returns {Promise<object>}
 */
export const enviarPosicion = async (pos) => {
  try {
    const res = await fetch(`${BACKEND_URL}/pos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pos),
    });

    const contentType = res.headers.get("content-type");
    if (!res.ok) {
      const text = await res.text();
      console.error("[API] enviarPosicion - Error:", text);
      throw new Error(text || "Error al enviar posición");
    }

    if (!contentType?.includes("application/json")) {
      const text = await res.text();
      console.error("[API] enviarPosicion - Respuesta no JSON:", text);
      throw new Error("Respuesta del backend no es JSON");
    }

    return await res.json();
  } catch (err) {
    console.error("[API] enviarPosicion:", err);
    return { estado: "Error al enviar posición" };
  }
};

/**
 * 🔹 Login o registro
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>}
 */
export const auth = async (email, password) => {
  try {
    const res = await fetch(`${BACKEND_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const contentType = res.headers.get("content-type");

    if (!res.ok) {
      const text = await res.text();
      console.error("[API] auth - Error:", text);
      throw new Error(text || "Error en autenticación");
    }

    if (!contentType?.includes("application/json")) {
      const text = await res.text();
      console.error("[API] auth - Respuesta no JSON:", text);
      throw new Error("Respuesta del backend no es JSON");
    }

    return await res.json();
  } catch (err) {
    console.error("[API] auth:", err);
    return { error: err.message || "Error desconocido" };
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
    const res = await fetch(`${BACKEND_URL}/get_geofence`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const contentType = res.headers.get("content-type");

    if (!res.ok) {
      const text = await res.text();
      console.error("[API] obtenerGeocerca - Error:", text);
      throw new Error(text || "Error al obtener geocerca");
    }

    if (!contentType?.includes("application/json")) {
      const text = await res.text();
      console.error("[API] obtenerGeocerca - Respuesta no JSON:", text);
      throw new Error("Respuesta del backend no es JSON");
    }

    return await res.json();
  } catch (err) {
    console.error("[API] obtenerGeocerca:", err);
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
    const res = await fetch(`${BACKEND_URL}/set_geofence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(geojson),
    });

    const contentType = res.headers.get("content-type");

    if (!res.ok) {
      const text = await res.text();
      console.error("[API] guardarGeocerca - Error:", text);
      throw new Error(text || "Error al guardar geocerca");
    }

    if (!contentType?.includes("application/json")) {
      const text = await res.text();
      console.error("[API] guardarGeocerca - Respuesta no JSON:", text);
      throw new Error("Respuesta del backend no es JSON");
    }

    return await res.json();
  } catch (err) {
    console.error("[API] guardarGeocerca:", err);
    return { success: false, message: "Error al guardar geocerca" };
  }
};



