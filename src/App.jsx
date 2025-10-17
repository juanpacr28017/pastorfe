import { useEffect, useRef, useState } from "react";
import { enviarPosicion, obtenerGeocerca } from "./api";
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
      const existingMap = document.getElementById("map");
      if (existingMap && existingMap._leaflet_id) {
        existingMap._leaflet_id = null;
      }

      mapRef.current = L.map("map").setView([40.4168, -3.7038], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Cargar geocerca desde backend
      const geojson = await obtenerGeocerca();
      if (geojson) {
        L.geoJSON(geojson, {
          style: { color: "green", fillOpacity: 0.3 }
        }).addTo(mapRef.current);
      }

      // Grupo para elementos dibujados
      drawnItemsRef.current = new L.FeatureGroup().addTo(mapRef.current);

      // Control de dibujo
      const drawControl = new L.Control.Draw({
        draw: {
          polygon: true,
          circle: false,
          rectangle: false,
          marker: false,
          polyline: false
        },
        edit: {
          featureGroup: drawnItemsRef.current
        }
      });
      mapRef.current.addControl(drawControl);

      // Evento al crear una geocerca
      mapRef.current.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        drawnItemsRef.current.addLayer(layer);
        const geojson = layer.toGeoJSON();

        fetch("https://perimeter-prototype.onrender.com/set_geofence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geojson.geometry)
        })
          .then(res => res.json())
          .then(data => alert("Geocerca guardada correctamente"))
          .catch(err => alert("Error al guardar geocerca"));
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
        setEstado(res.estado);
        markerRef.current.setLatLng([pos.lat, pos.lon]);
        mapRef.current.setView([pos.lat, pos.lon]);
      } catch (err) {
        console.error("Error en API:", err);
        alert("Error al enviar posición");
      }
    });
  };

  return (
    <>
      <h4>Perimeter Dashboard (Prototype)</h4>
      <div id="map" style={{ height: "500px" }}></div>
      <button onClick={handleEnviar}>Enviar posición actual</button>
      {estado && <p>Estado: {estado}</p>}
    </>
  );
}

export default App;
