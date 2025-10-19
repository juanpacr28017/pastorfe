import { useLayoutEffect, useRef, useState } from "react";
import { enviarPosicion, obtenerGeocerca, guardarGeocerca } from "./api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

function App() {
  const mapRef = useRef(null);
  const markersRef = useRef({}); // Guardará los markers por device_id
  const drawnItemsRef = useRef(null);
  const [estado, setEstado] = useState(null);

  useLayoutEffect(() => {
    const mapContainer = document.getElementById("map");
    if (mapContainer && mapContainer._leaflet_id) {
        mapContainer._leaflet_id = null;
        mapContainer.innerHTML = "";
    }
    const initMap = async () => {
      // Inicializar mapa centrado en Madrid
      mapRef.current = L.map("map").setView([40.4168, -3.7038], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(mapRef.current);

      // Crear grupo de capas para dibujos
      drawnItemsRef.current = new L.FeatureGroup().addTo(mapRef.current);

      // Control de dibujo (solo polígonos)
      const drawControl = new L.Control.Draw({
        draw: { polygon: true },
        edit: { featureGroup: drawnItemsRef.current },
      });
      mapRef.current.addControl(drawControl);

      // Cargar geocerca desde backend
      const geojson = await obtenerGeocerca();
      if (geojson) {
        L.geoJSON(geojson, { style: { color: "green", fillOpacity: 0.3 } }).addTo(mapRef.current);
      }

      // EventSource para streaming de posiciones
      const evtSource = new EventSource("https://perimeter-prototype.onrender.com/stream");
      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const { device_id, lat, lon } = data;
        console.log("Evento SSE recibido:", data);

        // Crear o actualizar marcador
        if (!markersRef.current[device_id]) {
          markersRef.current[device_id] = L.circleMarker([lat, lon], { radius: 8 }).addTo(mapRef.current);
        } else {
          markersRef.current[device_id].setLatLng([lat, lon]);
        }
      };
    };

    initMap();
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

        // Actualizar marcador local
        if (!markersRef.current[pos.device_id]) {
          markersRef.current[pos.device_id] = L.circleMarker([pos.lat, pos.lon], { radius: 8 }).addTo(mapRef.current);
        } else {
          markersRef.current[pos.device_id].setLatLng([pos.lat, pos.lon]);
        }

        mapRef.current.setView([pos.lat, pos.lon]);
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

