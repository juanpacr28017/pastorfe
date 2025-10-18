import { useEffect, useRef, useState } from "react";
import { enviarPosicion, obtenerGeocerca, guardarGeocerca } from "./api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

function App() {
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const drawnItemsRef = useRef(null);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    const initMap = async () => {
      // Reiniciar mapa si ya existe
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

      // Cargar geocerca desde backend
      const geojson = await obtenerGeocerca();
      if (geojson) {
        L.geoJSON(geojson, {
          style: { color: "green", fillOpacity: 0.3 },
        }).addTo(mapRef.current);
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
        if (res?.status === "ok" || res?.success) {
          alert("✅ Geocerca guardada correctamente");
        } else {
          alert("❌ Error al guardar geocerca");
        }
      });
    };

    initMap();
  }, []);

  // === STREAMING: recibir posiciones en tiempo real ===
  useEffect(() => {
    if (!mapRef.current) return;

    const eventSource = new EventSource("https://perimeter-prototype.onrender.com/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { device_id, lat, lon, estado } = data;

        // Crear marcador si no existe
        if (!markersRef.current[device_id]) {
          markersRef.current[device_id] = L.circleMarker([lat, lon], {
            radius: 6,
            color: "blue",
            fillColor: "blue",
            fillOpacity: 0.7,
          })
            .addTo(mapRef.current)
            .bindTooltip(device_id, { permanent: false });
        }

        // Actualizar posición y color
        const marker = markersRef.current[device_id];
        marker.setLatLng([lat, lon]);
        marker.setStyle({
          color: estado === "inside" ? "green" : "red",
          fillColor: estado === "inside" ? "green" : "red",
        });
      } catch (err) {
        console.error("Error procesando evento SSE:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("❌ Error en SSE:", err);
    };

    return () => eventSource.close();
  }, []);

  // === Enviar posición actual del navegador ===
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

      // Crear o actualizar marcador local
      if (!markersRef.current[pos.device_id]) {
        markersRef.current[pos.device_id] = L.circleMarker([pos.lat, pos.lon], {
          radius: 8,
          color: "blue",
          fillColor: "blue",
          fillOpacity: 0.8,
        })
          .addTo(mapRef.current)
          .bindTooltip("browser-client", { permanent: false });
      } else {
        const marker = markersRef.current[pos.device_id];
        marker.setLatLng([pos.lat, pos.lon]);
      }

      try {
        const res = await enviarPosicion(pos);
        setEstado(res.estado || "Posición enviada correctamente");
        mapRef.current.setView([pos.lat, pos.lon]);
      } catch (err) {
        console.error("Error al enviar posición:", err);
        alert("Error al enviar posición");
      }
    });
  };

  return (
    <>
      <h4>Perimeter Dashboard (Realtime)</h4>
      <div
        id="map"
        style={{
          height: "500px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          marginBottom: "10px",
        }}
      ></div>
      <button
        onClick={handleEnviar}
        style={{
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
