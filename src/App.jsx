import { useEffect, useRef, useState } from "react";
import { enviarPosicion, obtenerGeocerca, guardarGeocerca } from "./api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

function App() {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    const initMap = async () => {
      // Reiniciar mapa si ya existe (prevención en modo dev)
      const existingMap = document.getElementById("map");
      if (existingMap && existingMap._leaflet_id) {
        existingMap._leaflet_id = null;
      }

      // Inicializar mapa centrado en Madrid
      mapRef.current = L.map("map").setView([40.4168, -3.7038], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      }).addTo(mapRef.current);

      // Intentar cargar geocerca desde backend
      const geojson = await obtenerGeocerca();
      if (geojson) {
        L.geoJSON(geojson, {
          style: { color: "green", fillOpacity: 0.3 },
        }).addTo(mapRef.current);
      } else {
        console.warn("No se encontró una geocerca guardada en el backend.");
      }

      // Crear grupo de capas para dibujos
      drawnItemsRef.current = new L.FeatureGroup().addTo(mapRef.current);

      // Control de dibujo (solo polígonos)
      const drawControl = new L.Control.Draw({
        draw: {
          polygon: true,
          circle: false,
          rectangle: false,
          marker: false,
          polyline: false,
        },
        edit: {
          featureGroup: drawnItemsRef.current,
        },
      });
      mapRef.current.addControl(drawControl);

      // Evento: cuando se crea una nueva geocerca
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

      // Marcador inicial
      markerRef.current = L.circleMarker([40.4168, -3.7038], { radius: 8 }).addTo(mapRef.current);
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
        markerRef.current.setLatLng([pos.lat, pos.lon]);
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