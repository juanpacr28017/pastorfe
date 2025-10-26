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

  // --- 🗺️ INICIALIZAR MAPA ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [-3.7038, 40.4168],
      zoom: 14,
    });

    map.on("load", () => {
      // Añadir source para geofence
      map.addSource("geofence", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "geofence-fill",
        type: "fill",
        source: "geofence",
        paint: {
          "fill-color": "#00FF88",
          "fill-opacity": 0.3,
        },
      });

      map.addLayer({
        id: "geofence-outline",
        type: "line",
        source: "geofence",
        paint: {
          "line-color": "#00FF88",
          "line-width": 2,
        },
      });

      // Añadir source para dibujo
      map.addSource("drawing", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "drawing-line",
        type: "line",
        source: "drawing",
        paint: {
          "line-color": "#FFD700",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "drawing-points",
        type: "circle",
        source: "drawing",
        paint: {
          "circle-radius": 5,
          "circle-color": "#FFD700",
        },
      });
    });

    // Handler para dibujo
    map.on("click", (e) => {
      if (!isDrawing) return;
      const coords = [e.lngLat.lng, e.lngLat.lat];
      setDrawingCoords((prev) => [...prev, coords]);
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isDrawing]);

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

  // --- 📦 CERRAR SESIÓN ---
  const handleLogout = () => {
    localStorage.removeItem("jwt");
    setToken(null);
    setPolygon(null);
    setPositions([]);
    // Limpiar marcadores
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  };

  // --- 🧭 CARGAR GEO-FENCE ---
  const loadGeofence = async () => {
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/get_geofence`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
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

  // --- 💾 GUARDAR GEO-FENCE ---
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
      setStreamConnected(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [token]);

  // --- CARGAR GEOFENCE AL INICIAR SESIÓN ---
  useEffect(() => {
    if (token) loadGeofence();
  }, [token]);

  // --- 🎨 ACTUALIZAR GEOFENCE EN MAPA ---
  useEffect(() => {
    if (!mapRef.current || !polygon) return;

    const map = mapRef.current;
    const source = map.getSource("geofence");

    if (source) {
      source.setData({
        type: "Feature",
        geometry: polygon,
      });
    }
  }, [polygon]);

  // --- 🎨 ACTUALIZAR DIBUJO EN MAPA ---
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const source = map.getSource("drawing");

    if (source && drawingCoords.length > 0) {
      const features = [];

      // Línea conectando puntos
      if (drawingCoords.length > 1) {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: drawingCoords,
          },
        });
      }

      // Puntos
      drawingCoords.forEach((coord) => {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: coord,
          },
        });
      });

      source.setData({
        type: "FeatureCollection",
        features: features,
      });
    } else if (source) {
      source.setData({
        type: "FeatureCollection",
        features: [],
      });
    }

    // Cambiar cursor
    if (map.getCanvas()) {
      map.getCanvas().style.cursor = isDrawing ? "crosshair" : "";
    }
  }, [drawingCoords, isDrawing]);

  // --- 🎨 ACTUALIZAR POSICIONES EN MAPA ---
  useEffect(() => {
    if (!mapRef.current) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Añadir nuevos marcadores
    positions.forEach((pos) => {
      const el = document.createElement("div");
      el.className = "marker";
      el.style.backgroundColor = pos.estado === "inside" ? "#00FF00" : "#FF0000";
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";

      const marker = new maplibregl.Marker(el)
        .setLngLat([pos.lon, pos.lat])
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [positions]);

  // --- ✏️ DIBUJO DE POLÍGONOS ---
  const startDrawing = () => {
    setIsDrawing(true);
    setDrawingCoords([]);
    setPolygon(null);
  };

  const finishDrawing = () => {
    if (drawingCoords.length < 3) {
      alert("Necesitas al menos 3 puntos para crear un polígono");
      return;
    }

    const closedCoords = [...drawingCoords, drawingCoords[0]];
    setPolygon({
      type: "Polygon",
      coordinates: [closedCoords],
    });
    setIsDrawing(false);
    setDrawingCoords([]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setDrawingCoords([]);
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
          <div className="flex gap-2 flex-wrap justify-center">
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
            {!isDrawing ? (
              <button
                onClick={startDrawing}
                className="bg-purple-600 hover:bg-purple-700 p-2 rounded"
              >
                ✏️ Dibujar polígono
              </button>
            ) : (
              <>
                <button
                  onClick={finishDrawing}
                  className="bg-blue-600 hover:bg-blue-700 p-2 rounded"
                >
                  ✓ Finalizar polígono
                </button>
                <button
                  onClick={cancelDrawing}
                  className="bg-gray-600 hover:bg-gray-700 p-2 rounded"
                >
                  ✕ Cancelar
                </button>
              </>
            )}
          </div>

          <p className="text-sm text-gray-400">
            {streamConnected ? "🟢 Streaming activo" : "🔴 Sin conexión al stream"}
            {isDrawing && ` | 📍 Puntos: ${drawingCoords.length}`}
          </p>

          <div
            ref={mapContainerRef}
            className="w-[90vw] h-[60vh] mt-4 rounded-lg overflow-hidden"
          />
        </div>
      )}
    </div>
  );
}

export default App;
