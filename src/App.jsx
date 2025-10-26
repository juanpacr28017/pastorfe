import React, { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Hacemos maplibregl accesible globalmente (importante para MapboxDraw)
window.maplibregl = maplibregl;

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(null);
  const [polygon, setPolygon] = useState(null);
  const [positions, setPositions] = useState([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const mapRef = useRef(null);

  // --- 🔐 Inicializar token limpio desde localStorage ---
  useEffect(() => {
    const stored = localStorage.getItem("jwt");
    if (stored) {
      try {
        const header = JSON.parse(atob(stored.split(".")[0]));
        if (header.alg !== "ES256") {
          localStorage.removeItem("jwt");
          setToken(null);
        } else {
          setToken(stored);
        }
      } catch {
        localStorage.removeItem("jwt");
        setToken(null);
      }
    }
  }, []);

  // --- 🔐 LOGIN / REGISTRO ---
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
      const jwt = data.access_token;

      if (!jwt) throw new Error("No se recibió token válido del backend");

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
    if (!token) return console.warn("⚠️ No hay token, no se carga geofence");

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

    const geometry = polygon || {
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
        console.error("❌ Token rechazado al guardar. Cerrando sesión.");
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

  // --- ✏️ HABILITAR DIBUJO EN EL MAPA ---
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
    });

    map.addControl(draw);

    map.on("draw.create", (e) => {
      const geo = e.features[0].geometry;
      console.log("🆕 Polígono dibujado:", geo);
      setPolygon(geo);
    });

    return () => map.removeControl(draw);
  }, []);

  // --- RENDER ---
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
            Guardar geocerca
          </button>

          <p className="text-sm text-gray-400">
            {streamConnected ? "🟢 Streaming activo" : "🔴 Sin conexión al stream"}
          </p>

          <div className="w-[90vw] h-[60vh] mt-4 rounded-lg overflow-hidden">
            <Map
              ref={mapRef}
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
                      "fill-opacity": 0.3,
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
