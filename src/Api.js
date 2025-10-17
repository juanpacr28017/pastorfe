// src/api.js
const API_URL = import.meta.env.VITE_API_URL || "https://perimeter-prototype.onrender.com/";

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
    if (!res.ok) throw new Error("Error al enviar posición");
    return await res.json();
  } catch (err) {
    console.error("Error en API:", err);
    return null;
  }
};
