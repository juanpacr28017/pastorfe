import { useLayoutEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient"; // ✅ Cliente centralizado
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
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔄 Escuchar estado de sesión
  useLayoutEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUser(data.session.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // 🧭 Inicializar mapa y lógica solo si hay usuario logueado
  useLayoutEffect(() => {
    if (!user) return;

    const mapContainer = document.getElementById("map");
    if (mapContainer?._leaflet_id) mapContainer._leaflet_id = null;

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

    // 📍 Crear geocerca
    map.on("draw:created", async (e) => {
      const layer = e.layer;
      drawnItemsRef.current.clearLayers();
      drawnItemsRef.current.addLayer(layer);

      const geojson = layer.toGeoJSON();
      const geofenceData = { name: "geocerca_manual", geometry: geojson.geometry };

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token; // ⚠️ RS256 token

        const res = await guardarGeocerca(geofenceData, token);
        console.log("✅ Geocerca guardada:", res);
        setMensaje("✅ Geocerca guardada correctamente");
      } catch (err) {
        console.error("❌ Error al guardar geocerca:", err);
        setMensaje("❌ Error al guardar geocerca. Revisa la consola.");
      }
    });

    // 📍 Cargar geocerca actual
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token; // ⚠️ RS256 token

      const geojson = await obtenerGeocerca(token);
      if (geojson?.coordinates?.length) {
        L.geoJSON(geojson, { style: { color: "green", fillOpacity: 0.3 } }).addTo(map);
      }
    })();

    // 📡 Escuchar posiciones en tiempo real
    const evtSource = new EventSource(`${import.meta.env.VITE_API_URL}/stream`);
    evtSource.onmessage = (e) => {
      const { device_id, lat, lon } = JSON.parse(e.data);
      if (!markersRef.current[device_id]) {
        markersRef.current[device_id] = L.circleMarker([lat, lon], { radius: 8 }).addTo(mapRef.current);
      } else {
        markersRef.current[device_id].setLatLng([lat, lon]);
      }
    };

    return () => {
      evtSource.close();
      if (mapRef.current) mapRef.current.remove();
    };
  }, [user]);

  // 📍 Enviar posición actual
  const handleEnviar = async () => {
    if (!navigator.geolocation) return alert("Geolocalización no soportada");

    navigator.geolocation.getCurrentPosition(async (position) => {
      const pos = { device_id: "test123", lat: position.coords.latitude, lon: position.coords.longitude };
      try {
        const res = await enviarPosicion(pos);
        setEstado(res.estado ?? "Posición enviada correctamente");
      } catch (err) {
        console.error("Error al enviar posición:", err);
        alert("Error al enviar posición");
      }
    });
  };

  // 🧑‍💻 Login o registro
  const handleLogin = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Registrar con redirect al frontend
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin }, // ⚠️ asegurarse de que es tu frontend
      });
      signupError
        ? alert("Error al crear cuenta: " + signupError.message)
        : alert("✅ Cuenta creada, revisa tu email para confirmar.");
    } else {
      setUser(data.user);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <>
      <h3>Perimeter Dashboard (Prototype)</h3>

      {!user ? (
        <form onSubmit={handleLogin} style={{ marginBottom: "20px" }}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginRight: "8px" }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ marginRight: "8px" }} />
          <button type="submit">Iniciar sesión / Registrarse</button>
        </form>
      ) : (
        <div style={{ marginBottom: "10px" }}>
          <p>👋 Bienvenido, {user.email}</p>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      )}

      {user && (
        <>
          <div id="map" style={{ height: "500px", border: "1px solid #ccc', borderRadius: '4px' }}></div>

          <button onClick={handleEnviar} style={{ marginTop: "10px", padding: "8px 12px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            Enviar posición actual
          </button>

          {estado && <p style={{ marginTop: "10px" }}>Estado: {estado}</p>}
          {mensaje && <p style={{ marginTop: "10px", color: mensaje.startsWith("✅") ? "green" : "red" }}>{mensaje}</p>}
        </>
      )}
    </>
  );
}

export default App;
