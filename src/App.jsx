import React, { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { auth, obtenerGeocerca, guardarGeocerca } from "./api";

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
  const [mapReady, setMapReady] = useState(false);
  
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

  // Sincronizar ref con estado
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  // --- 🗺️ INICIALIZAR MAPA ---
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !token) return;

    console.log("🗺️ Inicializando MapLibre GL...");

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
          }
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19
          }
        ],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
      },
      center: [-3.7038, 40.4168],
      zoom: 14,
    });

    // Añadir controles de navegación
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on("load", () => {
      console.log("✅ Mapa cargado correctamente");
      setMapReady(true);

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
          "line-width": 3,
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

    // Handler para dibujo usando ref
    map.on("click", (e) => {
      if (!isDrawingRef.current) return;
      
      const coords = [e.lngLat.lng, e.lngLat.lat];
      console.log("📍 Punto añadido:", coords);
      
      setDrawingCoords((prev) => {
        const newCoords = [...prev, coords];
        console.log("Total puntos:", newCoords.length);
        return newCoords;
      });
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [token]);

  // --- 🔐 LOGIN / REGISTRO (usando api.js) ---
  const handleAuth = async (e) => {
    e.preventDefault();
    
    const data = await auth(email, password);
    
    if (data.error) {
      alert(`❌ Error: ${data.error}`);
      return;
    }

    const jwt = data.access_token;
    if (!jwt) {
      alert("❌ No se recibió token válido del backend");
      return;
    }

    localStorage.setItem("jwt", jwt);
    setToken(jwt);
    alert("✅ Sesión iniciada correctamente");
  };

  // --- 📦 CERRAR SESIÓN ---
  const handleLogout = () => {
    localStorage.removeItem("jwt");
    setToken(null);
    setPolygon(null);
    setPositions([]);
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    
    // Destruir el mapa
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      setMapReady(false);
    }
  };

  // --- 🧭 CARGAR GEO-FENCE (usando api.js) ---
  const loadGeofence = async () => {
    if (!token) return;

    const data = await obtenerGeocerca(token);
    
    if (!data) {
      console.warn("⚠️ No se pudo cargar la geocerca");
      return;
    }

    console.log("🗺️ Geofence recibido:", data);
    setPolygon(data);
  };

  // --- 💾 GUARDAR GEO-FENCE (usando api.js) ---
  const saveGeofence = async () => {
    if (!token) {
      alert("Debes iniciar sesión primero");
      return;
    }

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

    const result = await guardarGeocerca({ geometry }, token);

    if (result.success === false) {
      alert(`❌ Error: ${result.message}`);
      return;
    }

    alert("🟢 Geocerca guardada correctamente");
    setPolygon(geometry);
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
    if (!mapRef.current || !polygon || !mapReady) return;

    const map = mapRef.current;
    const source = map.getSource("geofence");

    if (source) {
      source.setData({
        type: "Feature",
        geometry: polygon,
      });
    }
  }, [polygon, mapReady]);

  // --- 🎨 ACTUALIZAR DIBUJO EN MAPA ---
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

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
      map.getCanvas().style.cursor = isDrawing ? "crosshair" : "grab";
    }
  }, [drawingCoords, isDrawing, mapReady]);

  // --- 🎨 ACTUALIZAR POSICIONES EN MAPA ---
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

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
      el.style.boxShadow = "0 0 4px rgba(0,0,0,0.5)";

      const marker = new maplibregl.Marker(el)
        .setLngLat([pos.lon, pos.lat])
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [positions, mapReady]);

  // --- ✏️ DIBUJO DE POLÍGONOS ---
  const startDrawing = () => {
    console.log("🖊️ Modo dibujo activado");
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
    console.log("✅ Polígono creado:", closedCoords);
    setIsDrawing(false);
    setDrawingCoords([]);
  };

  const cancelDrawing = () => {
    console.log("❌ Dibujo cancelado");
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
              className="bg-red-600 hover:bg-red-700 p-2 rounded px-4"
            >
              Cerrar sesión
            </button>
            <button
              onClick={saveGeofence}
              className="bg-green-600 hover:bg-green-700 p-2 rounded px-4"
              disabled={!polygon}
            >
              💾 Guardar geocerca
            </button>
            {!isDrawing ? (
              <button
                onClick={startDrawing}
                className="bg-purple-600 hover:bg-purple-700 p-2 rounded px-4"
                disabled={!mapReady}
              >
                ✏️ Dibujar polígono
              </button>
            ) : (
              <>
                <button
                  onClick={finishDrawing}
                  className="bg-blue-600 hover:bg-blue-700 p-2 rounded px-4"
                >
                  ✓ Finalizar
                </button>
                <button
                  onClick={cancelDrawing}
                  className="bg-gray-600 hover:bg-gray-700 p-2 rounded px-4"
                >
                  ✕ Cancelar
                </button>
              </>
            )}
          </div>

          {!mapReady && (
            <div className="bg-blue-800 text-blue-100 px-4 py-2 rounded">
              ⏳ Cargando mapa...
            </div>
          )}

          {isDrawing && mapReady && (
            <div className="bg-yellow-800 text-yellow-100 px-4 py-2 rounded">
              🖱️ Haz clic en el mapa para añadir puntos ({drawingCoords.length} puntos)
            </div>
          )}

          <p className="text-sm text-gray-400">
            {streamConnected ? "🟢 Streaming activo" : "🔴 Sin conexión al stream"}
          </p>

          <div
            ref={mapContainerRef}
            className="w-[90vw] h-[60vh] mt-4 rounded-lg overflow-hidden border-2 border-gray-700 bg-gray-800"
            style={{ minHeight: "400px" }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
