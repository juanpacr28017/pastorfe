import React, { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(null);
  const [polygon, setPolygon] = useState(null);
  const [positions, setPositions] = useState([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingCoords, setDrawingCoords] = useState([]);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const isDrawingRef = useRef(false);

  // --- 🔐 Inicializar token limpio desde localStorage ---
  useEffect(() => {
    const stored = localStorage.getItem("jwt");
    if (stored) {
      try {
        const parts = stored.split(".");
        if (parts.length === 3) {
          const header = JSON.parse(atob(parts[0]));
          if (header.alg !== "ES256") {
            localStorage.removeItem("jwt");
            setToken(null);
          } else {
            setToken(stored);
          }
        } else {
          localStorage.removeItem("jwt");
          setToken(null);
        }
      } catch {
        localStorage.removeItem("jwt");
        setToken(null);
      }
    }
  }, []);

  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  // --- 🗺️ INICIALIZAR MAPA ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log("🗺️ Inicializando MapLibre GL...");

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", // ✅ estilo funcional
      center: [-3.7038, 40.4168],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      console.log("✅ Mapa cargado correctamente");

      // 🔴 Marcador de prueba
      const el = document.createElement("div");
      el.style.background = "red";
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      new maplibregl.Marker(el).setLngLat([-3.7038, 40.4168]).addTo(map);

      // Añadir sources
      map.addSource("geofence", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "geofence-fill",
        type: "fill",
        source: "geofence",
        paint: { "fill-color": "#00FF88", "fill-opacity": 0.3 },
      });

      map.addLayer({
        id: "geofence-outline",
        type: "line",
        source: "geofence",
        paint: { "line-color": "#00FF88", "line-width": 3 },
      });

      map.addSource("drawing", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "drawing-line",
        type: "line",
        source: "drawing",
        paint: {
          "line-color": "#FFD700",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "drawing-points",
        type: "circle",
        source: "drawing",
        paint: {
          "circle-radius": 6,
          "circle-color": "#FFD700",
          "circle-stroke-color": "#FFF",
          "circle-stroke-width": 2,
        },
      });
    });

    map.on("click", (e) => {
      if (!isDrawingRef.current) return;
      const coords = [e.lngLat.lng, e.lngLat.lat];
      console.log("📍 Punto añadido:", coords);
      setDrawingCoords((prev) => [...prev, coords]);
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
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

  const handleLogout = () => {
    localStorage.removeItem("jwt");
    setToken(null);
    setPolygon(null);
    setPositions([]);
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">🛰️ Perimeter Control</h1>

      {!token ? (
        <div className="flex flex-col gap-3 bg-gray-800 p-6 rounded-lg shadow-lg w-80">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 rounded bg-gray-700 text-white"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 rounded bg-gray-700 text-white"
          />
          <button
            onClick={handleAuth}
            className="bg-blue-600 hover:bg-blue-700 p-2 rounded"
          >
            Iniciar sesión / Registrar
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-sm text-gray-400">
            {streamConnected ? "🟢 Streaming activo" : "🔴 Sin conexión al stream"}
          </p>

          <div
            id="map"
            ref={mapContainerRef}
            className="mt-4 rounded-lg overflow-hidden border-2 border-gray-700"
          />
        </div>
      )}
    </div>
  );
}

export default App;
