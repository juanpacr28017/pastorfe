import { useLayoutEffect, useRef, useState } from "react";
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
  const [mensaje, setMensaje] = useState("");

  useLayoutEffect(() => {
    const mapContainer = document.getElementById("map");
    if (mapContainer && mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null;
    }

    const map = L.map("map").setView([40.4168, -3.7038], 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    drawnItemsRef.current = new L.FeatureGroup().addTo(map);

    const drawControl = new L.Control.Draw({
      draw: { polygon: true },
      edit: { featureGroup: drawnItemsRef.current },
    });
    map.addControl(drawControl);

    // 🟢 Cuando el usuario crea una nueva geocerca
    map.on("draw:created", async (e) => {
      const layer = e.layer;

      // 🔄 Limpiar cualquier geocerca anterior
      drawnItemsRef.current.clearLayers();
      drawnItemsRef.current.addLayer(layer);

      const geojson = layer.toGeoJSON();
      const geofenceData = {
        user_id: "default_user",
        name: "geocerca_manual",
        geometry: geojson.geometry,
      };

      try {
        const res = await guardarGeocerca(geofenceData);
        console.log("✅ Geocerca guardada:", res);
        setMensaje("✅ Geocerca guardada correctamente");
      } catch (err) {
        console.error("❌ Error al guardar geocerca:", err);
        setMensaje("❌ Error al guardar geocerca. Revisa la consola.");
      }
    });

    // 🟢 Cargar geocerca existente al iniciar
    obtenerGeocerca().then((geojson) => {
      if (geojson && geojson.coordinates?.length) {
        L.geoJSON(geojson, {
          style: { color: "green", fillOpacity: 0.3 },
        }).addTo(map);
      }
    });

    // 🔄 Escuchar posiciones en tiempo real (SSE)
    const evtSource = new EventSource("https://perimeter-prototype.onrender.com/stream");

    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const { device_id, lat, lon } = data;

      if (!markersRef.current[device_id]) {
        markersRef.current[device_id] = L.circleMarker([lat, lon], { radius: 8 }).addTo(mapRef.current);
      } else {
        markersRef.current[device_id].setLatLng([lat, lon]);
      }
    };

    evtSource.onerror = (err) => {
      console.error("❌ Error en SSE:", err);
    };

    // 🧹 Limpieza al desmontar el componente
    return () => {
      evtSource.close();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
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
        setEstado(res.estado ?? "Posición enviada correctamente");

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

      <div
        id="map"
        style={{ height: "500px", border: "1px solid #ccc", borderRadius: "4px" }}
      ></div>

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
      {mensaje && <p style={{ marginTop: "10px", color: mensaje.startsWith("✅") ? "green" : "red" }}>{mensaje}</p>}
    </>
  );
}

export default App;
