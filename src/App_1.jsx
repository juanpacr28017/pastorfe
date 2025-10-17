import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { enviarPosicion } from "./api";

function App() {
  const [count, setCount] = useState(0);
  const [estado, setEstado] = useState(null);
  const [lastPos, setLastPos] = useState(null);

  const handleEnviar = async () => {
    // Aquí puedes reemplazar con valores dinámicos si quieres
    const pos = {
      device_id: "test123",
      lat: 40.4165,
      lon: -3.7038,
    };
    setLastPos(pos);

    const res = await enviarPosicion(pos);
    if (res?.estado) setEstado(res.estado);
  };

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <h1>Vite + React</h1>

      {/* Contador */}
      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
        <p>Edit <code>src/App.jsx</code> and save to test HMR</p>
      </div>

      {/* Enviar posición al backend */}
      <div className="card">
        <button onClick={handleEnviar}>Enviar posición</button>
        {lastPos && (
          <p>
            Última posición: lat={lastPos.lat}, lon={lastPos.lon}
          </p>
        )}
        {estado && <p>Estado geofence: {estado}</p>}
      </div>

      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
