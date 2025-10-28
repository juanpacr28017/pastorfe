import React, { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { auth, obtenerGeocerca, guardarGeocerca } from "./api";
import { useToast, ToastContainer } from "./Toast";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Distancia de advertencia en metros (ajustable)
const WARNING_DISTANCE = 50; // 50 metros del borde

// Función para calcular la distancia de un punto al borde del polígono
function distanceToPolygonEdge(point, polygon) {
  if (!polygon || !polygon.coordinates || !polygon.coordinates[0]) {
    return Infinity;
  }

  const coords = polygon.coordinates[0];
  let minDistance = Infinity;

  // Calcular distancia a cada segmento del polígono
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    
    const distance = pointToSegmentDistance(
      [point.lon, point.lat],
      p1,
      p2
    );
    
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

// Calcular distancia de un punto a un segmento de línea (en metros)
function pointToSegmentDistance(point, segStart, segEnd) {
  const [px, py] = point;
  const [x1, y1] = segStart;
  const [x2, y2] = segEnd;

  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;

  // Convertir de grados a metros (aproximado)
  const metersPerDegree = 111320; // a nivel del ecuador
  return Math.sqrt(dx * dx + dy * dy) * metersPerDegree;
}

// Determinar el estado del marcador según distancia
function getMarkerState(pos, polygon, warningDistance) {
  console.log("🔍 getMarkerState llamada:", { 
    device: pos.device_id, 
    estado: pos.estado, 
    hasPolygon: !!polygon,
    warningDistance 
  });

  if (pos.estado === "outside") {
    return { color: "#FF0000", label: "Fuera", emoji: "🔴" };
  }

  if (!polygon) {
    return { color: "#00FF00", label: "Dentro", emoji: "✅" };
  }

  const distance = distanceToPolygonEdge(pos, polygon);
  console.log(`📏 Distancia calculada: ${distance.toFixed(1)}m vs límite ${warningDistance}m`);

  if (distance <= warningDistance) {
    return { color: "#FFA500", label: "Cerca del borde", emoji: "⚠️" }; // Naranja
  }

  return { color: "#00FF00", label: "Dentro", emoji: "✅" }; // Verde
}

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
  const [warningDistance, setWarningDistance] = useState(50); // Estado para distancia ajustable
  
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const isDrawingRef = useRef(false);

  // Hook de toasts
  const toast = useToast();

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
      toast.success("Mapa cargado correctamente");

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

  // --- 🔐 LOGIN / REGISTRO (usando api.js + toast) ---
  const handleAuth = async (e) => {
    e.preventDefault();
    
    toast.info("Autenticando...");
    const data = await auth(email, password);
    
    if (data.error) {
      toast.error(`Error: ${data.error}`);
      return;
    }

    const jwt = data.access_token;
    if (!jwt) {
      toast.error("No se recibió token válido del backend");
      return;
    }

    localStorage.setItem("jwt", jwt);
    setToken(jwt);
    toast.success("Sesión iniciada correctamente");
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

    toast.info("Sesión cerrada");
  };

  // --- 🧭 CARGAR GEO-FENCE (usando api.js + toast) ---
  const loadGeofence = async () => {
    if (!token) return;

    const data = await obtenerGeocerca(token);
    
    if (!data) {
      toast.warning("No hay geocerca guardada");
      return;
    }

    console.log("🗺️ Geofence recibido:", data);
    setPolygon(data);
    toast.success("Geocerca cargada");
  };

  // --- 💾 GUARDAR GEO-FENCE (usando api.js + toast) ---
  const saveGeofence = async () => {
    if (!token) {
      toast.error("Debes iniciar sesión primero");
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

    toast.info("Guardando geocerca...");
    const result = await guardarGeocerca({ geometry }, token);

    if (result.success === false) {
      toast.error(`Error: ${result.message}`);
      return;
    }

    setPolygon(geometry);
    toast.success("Geocerca guardada correctamente");
  };

  // --- 📡 STREAM DE POSICIONES ---
  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource(`${BACKEND_URL}/stream`);
    setStreamConnected(true);
    toast.info("Conectado al stream de posiciones");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setPositions((prev) => [...prev.slice(-50), data]);
    };

    eventSource.onerror = () => {
      setStreamConnected(false);
      eventSource.close();
      toast.warning("Stream desconectado");
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

    // Agrupar posiciones por device_id para obtener solo la última de cada dispositivo
    const latestPositions = {};
    positions.forEach((pos) => {
      if (!latestPositions[pos.device_id] || pos.ts > latestPositions[pos.device_id].ts) {
        latestPositions[pos.device_id] = pos;
      }
    });

    // Limpiar todos los marcadores actuales
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Crear un marcador por cada dispositivo (solo última posición)
    Object.values(latestPositions).forEach((pos) => {
      console.log("📍 Procesando posición:", pos);
      
      const markerState = getMarkerState(pos, polygon, warningDistance);
      console.log("🎨 Estado del marcador:", markerState);

      const el = document.createElement("div");
      el.className = "marker";
      el.style.backgroundColor = markerState.color;
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 6px rgba(0,0,0,0.7)";
      el.style.transition = "all 0.3s ease";

      // Calcular distancia al borde si está dentro
      let distanceInfo = "";
      if (pos.estado === "inside" && polygon) {
        const distance = distanceToPolygonEdge(pos, polygon);
        console.log(`📏 Distancia al borde para ${pos.device_id}: ${distance.toFixed(1)}m (Límite: ${warningDistance}m)`);
        distanceInfo = `<strong>Distancia al borde:</strong> ${distance.toFixed(1)}m<br/>`;
      }

      // Tooltip con info del dispositivo
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<div style="color: black; padding: 4px;">
          <strong>Device:</strong> ${pos.device_id}<br/>
          <strong>Estado:</strong> ${markerState.emoji} ${markerState.label}<br/>
          ${distanceInfo}
          <strong>Coords:</strong> ${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}
        </div>`
      );

      const marker = new maplibregl.Marker(el)
        .setLngLat([pos.lon, pos.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [positions, mapReady, polygon, warningDistance]);

  // --- ✏️ DIBUJO DE POLÍGONOS ---
  const startDrawing = () => {
    console.log("🖊️ Modo dibujo activado");
    setIsDrawing(true);
    setDrawingCoords([]);
    setPolygon(null);
    toast.info("Haz clic en el mapa para añadir puntos");
  };

  const finishDrawing = () => {
    if (drawingCoords.length < 3) {
      toast.warning("Necesitas al menos 3 puntos para crear un polígono");
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
    toast.success("Polígono creado correctamente");
  };

  const cancelDrawing = () => {
    console.log("❌ Dibujo cancelado");
    setIsDrawing(false);
    setDrawingCoords([]);
    toast.info("Dibujo cancelado");
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      
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

          {/* Control de distancia de advertencia */}
          <div className="bg-gray-800 p-4 rounded-lg w-full max-w-md">
            <label className="block text-sm font-medium mb-2">
              Distancia de advertencia: <span className="text-yellow-400">{warningDistance}m</span>
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={warningDistance}
              onChange={(e) => setWarningDistance(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>10m</span>
              <span>200m</span>
            </div>
            <div className="flex gap-2 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Seguro</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span>Advertencia</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Fuera</span>
              </div>
            </div>
          </div>

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


