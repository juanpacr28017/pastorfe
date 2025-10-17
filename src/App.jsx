import { useEffect, useRef, useState } from "react";
import { enviarPosicion } from "./api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function App() {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    // Verificar si el contenedor ya tiene un mapa
    const existingMap = document.getElementById("map");
    if (existingMap && existingMap._leaflet_id) {
      existingMap._leaflet_id = null; // forzar reinicialización
    }

    // Inicializar el mapa
    mapRef.current = L.map("map").setView([40.4168, -3.7038], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Dibujar geocerca
    const fenceCoords = [
      [40.4180, -3.7050],
      [40.4180, -3.7000],
      [40.4140, -3.7000],
      [40.4140, -3.7050]
    ];
    L.polygon(fenceCoords, { color: "green" }).addTo(mapRef.current);

    // Crear marcador inicial
    markerRef.current = L.circleMarker([40.4168, -3.7038], { radius: 8 }).addTo(mapRef.current);
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
    <div>
      <h3>Perimeter Dashboard (Prototype)</h3>
      <button onClick={handleEnviar}>Enviar posición actual</button>
      {estado && <p>Estado: {estado}</p>}
      <div id="map" style={{ height: "90vh", width: "100%" }}></div>
    </div>
  );
}

export default App;
