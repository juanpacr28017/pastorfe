import React, { useState, useEffect } from "react";
import Map, { Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(null); // Inicialmente null
  const [polygon, setPolygon] = useState(null);
  const [positions, setPositions] = useState([]);
  const [streamConnected, setStreamConnected] = useState(false);

  // --- 🔐 LOGIN O REGISTRO ---
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al autenticar");

      console.log("🧾 Respuesta auth:", data);

      const jwt = data.access_token || data.session?.access_token;
      if (!jwt) throw new Error("No se recibió token válido del backend");

      // Guardamos el token recién recibido
      localStorage.setItem("jwt", jwt);
      setToken(jwt);
      alert("✅ Sesión iniciada correctamente");
    } catch (err) {
      console.error("❌ Error autenticando:", err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  // --- 📦 CERRAR SESIÓN ---
  const handleLogout = () => {
    localStorage.removeItem("jwt");
    setToken(null);
    setPolygon(null);
    setPositions([]);
  };

  // --- 🧭 CARGAR GEO-FENCE ---
  const loadGeofence = async () => {
    if (!token) return;

    console.log("📡 Cargando geofence con token:", token.slice(0, 30), "...");

    try {
      const res = await fetch(`${BACKEND_URL}/get_geofence`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        console.error("❌ Token rechazado (401). Cerrando sesión.");
        handleLogout();
        return;
      }

      const data = await res.json();
      console.log("🗺️ Geofence recibido:", data);
      setPolygon(data);
    } catch (err) {
      console.error("❌ Error cargando geofence:", err);
    }
  };

  // --- 💾 GUARDAR GEO-FENCE DE EJEMPLO ---
  const saveGeofence = async () => {
    if (!token) return alert("Debes iniciar sesión primero");

    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [-3.705, 40.418],
          [-3.700, 40.418],
          [-3.700, 40.414],
          [-3.705, 40.414],
          [-3.705, 40.418],
        ],
      ],
    };

    console.log("💾 Guardando geofence con token:", token.slice(0, 30), "...");

    try {
      const res = await fetch(`${BACKEND_URL}/set_geofence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ geometry }),
      });

      if (res.status === 401) {
        console.error("❌ Token rechazado (401). Cerrando sesión.");
        handleLogout();
        return;
      }

      const data = await res.json();
      if (res.ok) {
        alert("🟢 Geocerca guardada correctamente");
        setPolygon(geometry);
      } else {
        alert(`❌ Error: ${data.detail || data.message}`);
      }
    } catch (err) {
      console.error("❌ Error guardando geofence:", err);
    }
  };

  // --- 📡 STREAM DE POSICIONES ---
  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource(`${BACKEND_URL}/stream`);
    setStreamConnected(true);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setPositions((prev) => [...prev.slice(-50), data]);
    };

    eventSource.onerror = () => {
      console.warn("⚠️ Stream desconectado");
      setStreamConnected(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [token]);

  // --- CARGAR GEOFENCE AL INICIAR SESIÓN ---
  useEffect(() => {
    if (token) loadGeofence();
  }, [token]);

  // --- MAPA ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">🛰️ Perimeter Control</h1>

      {!token ? (
        <form
          onSubmit={handleAuth}
          className="flex flex-col gap-3 bg-gray-800 p-6 rounded-lg shadow-lg w-80"
        >
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 rounded bg-gray-700 text-white"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 rounded bg-gray-700 text-white"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 p-2 rounded"
          >
            Iniciar sesión / Registrar
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 p-2 rounded"
          >
            Cerrar sesión
          </button>
          <button
            onClick={saveGeofence}
            className="bg-green-600 hover:bg-green-700 p-2 rounded"
          >
            Guardar geocerca de ejemplo
          </button>

          <p className="text-sm text-gray-400">
            {streamConnected ? "🟢 Streaming activo" : "🔴 Sin conexión al stream"}
          </p>

          <div className="w-[90vw] h-[60vh] mt-4 rounded-lg overflow-hidden">
            <Map
              mapLib={maplibregl}
              initialViewState={{
                longitude: -3.7038,
                latitude: 40.4168,
                zoom: 14,
              }}
              style={{ width: "100%", height: "100%" }}
              mapStyle="https://demotiles.maplibre.org/style.json"
            >
              {polygon && polygon.coordinates && (
                <Source id="geofence" type="geojson" data={polygon}>
                  <Layer
                    id="geofence-layer"
                    type="fill"
                    paint={{
                      "fill-color": "#00FF88",
                      "fill-opacity": 0.2,
                    }}
                  />
                </Source>
              )}

              {positions.map((pos, idx) => (
                <Source
                  key={idx}
                  id={`pos-${idx}`}
                  type="geojson"
                  data={{
                    type: "Feature",
                    geometry: {
                      type: "Point",
                      coordinates: [pos.lon, pos.lat],
                    },
                  }}
                >
                  <Layer
                    id={`pos-layer-${idx}`}
                    type="circle"
                    paint={{
                      "circle-radius": 6,
                      "circle-color":
                        pos.estado === "inside" ? "#00FF00" : "#FF0000",
                    }}
                  />
                </Source>
              ))}
            </Map>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;



