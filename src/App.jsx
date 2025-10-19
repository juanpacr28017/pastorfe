import { useEffect, useRef, useState } from "react";
import { enviarPosicion, obtenerGeocerca, guardarGeocerca } from "./api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

function App() {
  const mapRef = useRef(null);
  const markersRef = useRef({}); // Para múltiples dispositivos
  const drawnItemsRef = useRef(null);
  const [estado, setEstado] = useState(null);
  const userId = "default_user"; // Reemplazar con Auth real si hay

  useEffect(() => {
    const initMap = async () => {
      // Inicializar mapa
      mapRef.current = L.map("map").setView([40.4168, -3.7038], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(mapRef.current);

      // Grupo de dibujos
      drawnItemsRef.current = new L.FeatureGroup().addTo(mapRef.current);

      // Control de dibujo (solo polígonos)
      const drawControl = new L.Control.Draw({
        draw: { polygon: true, circle: false, rectangle: false, marker: false, polyline: false },
        edit: { featureGroup: drawnItemsRef.current },
      });
      mapRef.current.addControl(drawControl);

      // Evento al crear geocerca
      mapRef.current.on(L.Draw.Event.CREATED, async (e) => {
        const layer = e.layer;
        drawnItemsRef.current.addLayer(layer);
        const geojson = layer.toGeoJSON().geometry;
        geojson.user_id = userId;

        const res = await guardarGeocerca(geojson);
        alert(res.status === "ok" ? "✅ Geocerca guardada" : "❌ Error");
      });

      // Cargar geocerca inicial
      const geojson = await obtenerGeocerca(userId);
      if (geojson) {
        L.geoJSON(geojson, { style: { color: "green", fillOpacity: 0.3 } }).addTo(mapRef.current);
      }

      // Conexión SSE para posiciones en tiempo real
      const evtSource = new EventSource(`${import.meta.env.VITE_API_URL}/stream`);
      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const { device_id, lat, lon } = data;

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
    if (!navigator.geolocation) return alert("Geolocalización no soportada");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const pos = { device_id: "test123", lat: position.coords.latitude, lon: position.coords.longitude, user_id: userId };
      const res = await enviarPosicion(pos);
      setEstado(res.estado || "Posición enviada correctamente");
    });
  };

  return (
    <>
      <h4>Perimeter Dashboard</h4>
      <div id="map" style={{ height: "500px", border: "1px solid #ccc", borderRadius: "4px" }}></div>
      <button onClick={handleEnviar} style={{ marginTop: "10px", padding: "8px 12px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
        Enviar posición actual
      </button>
      {estado && <p style={{ marginTop: "10px" }}>Estado: {estado}</p>}
    </>
  );
}

export default App;
