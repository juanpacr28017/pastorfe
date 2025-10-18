import { useEffect, useRef, useState } from "react";
import { enviarPosicion, obtenerGeocerca, guardarGeocerca } from "./api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

function App() {
  const mapRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const [estado, setEstado] = useState(null);
  const markersRef = useRef({});

  useEffect(() => {
    const initMap = async () => {
      const existingMap = document.getElementById("map");
      if (existingMap && existingMap._leaflet_id) {
        existingMap._leaflet_id = null;
      }

      mapRef.current = L.map("map").setView([40.4168, -3.7038], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(mapRef.current);

      const geojson = await obtenerGeocerca();
      if (geojson) {
        L.geoJSON(geojson, {
          style: { color: "green", fillOpacity: 0.3 },
        }).addTo(mapRef.current);
      }

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
        alert(res?.success !== false ? "✅ Geocerca guardada" : "❌ Error al guardar");
      });

      const eventSource = new EventSource("https://pastorfe.onrender.com/stream");
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { device_id, lat, lon, estado } = data;

        if (!markersRef.current[device_id]) {
          markersRef.current[device_id] = L.circleMarker([lat, lon], {
            radius: 8,
            color: estado === "inside" ? "green" : "red",
          }).addTo(mapRef.current).bindTooltip(device_id);
        } else {
          const marker = markersRef.current[device_id];
          marker.setLatLng([lat, lon]);
          marker.setStyle({ color: estado === "inside" ? "green" : "red" });
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
        device_id: "browser-client",
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
      const res = await enviarPosicion(pos);
      setEstado(res.estado || "Posición enviada correctamente");
    });
  };

  return (
    <>
      <h4>Perimeter Dashboard (Realtime)</h4>
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