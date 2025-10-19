import { useEffect, useRef, useState } from "react";
import { enviarPosicion, obtenerGeocerca, guardarGeocerca } from "./api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

const API_URL = import.meta.env.VITE_API_URL || "https://perimeter-prototype.onrender.com";

function App() {
  const mapRef = useRef(null);
  const markerRef = useRef(null); 
  const drawnItemsRef = useRef(null);
  const devicesRef = useRef({}); 
  const eventSourceRef = useRef(null);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    // Solo inicializar mapa si no existe
    if (mapRef.current) return;

    const initMap = async () => {
      mapRef.current = L.map("map").setView([40.4168, -3.7038], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(mapRef.current);

      // Cargar geocerca
      const geojson = await obtenerGeocerca();
      if (geojson && geojson.coordinates?.length) {
        L.geoJSON(geojson, { style: { color: "green", fillOpacity: 0.3 } }).addTo(mapRef.current);
      }

      // Grupo para dibujos
      drawnItemsRef.current = new L.FeatureGroup().addTo(mapRef.current);

      const drawControl = new L.Control.Draw({
        draw: { polygon: true, circle: false, rectangle: false, marker: false, polyline: false },
        edit: { featureGroup: drawnItemsRef.current },
      });
      mapRef.current.addControl(drawControl);

      mapRef.current.on(L.Draw.Event.CREATED, async (e) => {
        const layer = e.layer;
        drawnItemsRef.current.addLayer(layer);
        const geojson = layer.toGeoJSON().geometry;
        const res = await guardarGeocerca(geojson);
        if (res?.success !== false) {
          alert("✅ Geocerca guardada correctamente");
        } else {
          alert("❌ Error al guardar geocerca");
        }
      });

      // Marcador del navegador
      markerRef.current = L.circleMarker([40.4168, -3.7038], { radius: 8, color: "blue" }).addTo(mapRef.current);

      // Conexión SSE solo una vez
      if (!eventSourceRef.current) {
        eventSourceRef.current = new EventSource(`${API_URL}/stream`);
        eventSourceRef.current.onmessage = (event) => {
          const pos = JSON.parse(event.data);
          const { device_id, lat, lon } = pos;

          if (!mapRef.current) return;

          if (devicesRef.current[device_id]) {
            devicesRef.current[device_id].setLatLng([lat, lon]);
          } else {
            devicesRef.current[device_id] = L.circleMarker([lat, lon], {
              radius: 6,
              color: "red",
            }).addTo(mapRef.current).bindPopup(`Device: ${device_id}`);
          }
        };
      }
    };

    initMap();

    // Cleanup al desmontar
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const handleEnviar = () => {
    if (!navigator.geolocation) {
      alert("Geolocalización no soportada");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const pos = {
        device_id: "test123",
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };

      try {
        const res = await enviarPosicion(pos);
        setEstado(res.estado || "Posición enviada correctamente");
        if (markerRef.current) markerRef.current.setLatLng([pos.lat, pos.lon]);
        if (mapRef.current) mapRef.current.setView([pos.lat, pos.lon]);
      } catch (err) {
        console.error("Error al enviar posición:", err);
        alert("Error al enviar posición");
      }
    });
  };

  return (
    <>
      <h4>Perimeter Dashboard (Prototype)</h4>
      <div id="map" style={{ height: "500px", border: "1px solid #ccc", borderRadius: "4px" }}></div>
      <button
        onClick={handleEnviar}
        style={{
          marginTop: "10px",
          padding: "8px 12px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Enviar posición actual
      </button>
      {estado && <p style={{ marginTop: "10px" }}>Estado: {estado}</p>}
    </>
  );
}

export default App;