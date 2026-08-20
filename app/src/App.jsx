import { useEffect, useState } from "react";
import { collection, getCountFromServer, doc, getDoc } from "firebase/firestore";
import { db, CONFIG_COLLECTION, CONFIG_KEYS, RECORD_SPECS } from "./firebase";
import "./App.css";

// Etapa 1: só prova que o app novo enxerga os MESMOS dados do sistema atual.
// Leitura pura (getCountFromServer / getDoc) — nada é escrito no Firestore aqui.
function App() {
  const [status, setStatus] = useState("Conectando ao Firestore...");
  const [recordCounts, setRecordCounts] = useState(null);
  const [configFound, setConfigFound] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function checkConnection() {
      try {
        const recordEntries = Object.entries(RECORD_SPECS);
        const counts = {};
        for (const [key, spec] of recordEntries) {
          const snap = await getCountFromServer(collection(db, spec.col));
          counts[key] = snap.data().count;
        }

        const configPresent = {};
        for (const key of CONFIG_KEYS) {
          const snap = await getDoc(doc(db, CONFIG_COLLECTION, key));
          configPresent[key] = snap.exists();
        }

        if (!cancelled) {
          setRecordCounts(counts);
          setConfigFound(configPresent);
          setStatus("Conectado — leitura confirmada no mesmo projeto Firebase.");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || String(e));
          setStatus("Falha ao conectar.");
        }
      }
    }

    checkConnection();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 640 }}>
      <h1>Sinistro360 — Etapa 1 (scaffold)</h1>
      <p>{status}</p>
      {error && <p style={{ color: "crimson" }}>Erro: {error}</p>}

      {recordCounts && (
        <>
          <h2>Coleções por registro (s360_*)</h2>
          <ul>
            {Object.entries(recordCounts).map(([key, count]) => (
              <li key={key}>
                {key} → {RECORD_SPECS[key].col}: <strong>{count}</strong> documento(s)
              </li>
            ))}
          </ul>
        </>
      )}

      {configFound && (
        <>
          <h2>Config (s360_config)</h2>
          <ul>
            {Object.entries(configFound).map(([key, exists]) => (
              <li key={key}>
                {key}: {exists ? "existe" : "ainda não existe"}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;
