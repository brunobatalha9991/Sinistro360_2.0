// Fonte de dados via Firestore — mesma estratégia do HTML original:
//   - config pequena: 1 documento inteiro por chave (coleção s360_config)
//   - registros grandes/multiusuário: 1 documento por registro, diff +
//     writeBatch (nunca reenvia o conjunto inteiro), onSnapshot por coleção.
//
// NÃO é usado por padrão (ver DataProvider.jsx) e NÃO tem nenhuma credencial
// embutida no código — só conecta se VITE_DATA_SOURCE=firebase e as
// variáveis VITE_FIREBASE_* estiverem definidas (app/.env.local para
// rodar localmente, ou Secrets do GitHub Actions para o site publicado).
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp,
  collection, writeBatch,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { CONFIG_COLLECTION, CONFIG_KEYS, RECORD_SPECS } from "./schema";

export function firebaseEnvConfigured() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID
  );
}

export function readFirebaseConfigFromEnv() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function createFirebaseAdapter() {
  const app = initializeApp(readFirebaseConfigFromEnv());
  const db = getFirestore(app);

  // Login anônimo do Firebase — NÃO é o login do sistema (a tela de
  // e-mail/senha continua sendo a mesma, própria do app). É só uma
  // credencial técnica que as regras de segurança do Firestore passam a
  // exigir (request.auth != null), pra bloquear acesso direto de fora do
  // site. Não trava o carregamento dos dados abaixo: os listeners começam
  // de qualquer forma, então enquanto o método "Anônimo" não estiver
  // habilitado no Console (Authentication > Sign-in method), o app
  // continua funcionando exatamente como antes desta mudança.
  signInAnonymously(getAuth(app)).catch((e) => {
    console.warn(
      "[firebaseAdapter] login anônimo falhou — habilite 'Anônimo' em Authentication > Sign-in method no Console do Firebase.",
      e && e.message
    );
  });

  // Espelha localStorage[key] em memória, pra poder expor getAllRecords()
  // de forma síncrona (mesma UX do adapter offline) e pra servir de base
  // de comparação nos diffs de escrita.
  const recordCache = {}; // recordCache[key] = { id: registro }
  const remoteJsonCache = {}; // remoteJsonCache[key] = { id: jsonString } (o que já sabemos que está salvo)
  const configCache = {};
  Object.keys(RECORD_SPECS).forEach((k) => { recordCache[k] = {}; remoteJsonCache[k] = {}; });
  CONFIG_KEYS.forEach((k) => { configCache[k] = null; });

  const listeners = new Set();
  function notify() { listeners.forEach((fn) => fn()); }

  function getAllRecords() {
    const out = {};
    Object.keys(RECORD_SPECS).forEach((key) => {
      const spec = RECORD_SPECS[key];
      out[key] = spec.keyed ? { ...recordCache[key] } : Object.values(recordCache[key]);
    });
    return out;
  }
  function getAllConfig() { return { ...configCache }; }

  function saveRecord(key, value) {
    const spec = RECORD_SPECS[key];
    const nextMap = {};
    if (spec.keyed) Object.keys(value || {}).forEach((id) => { nextMap[id] = value[id]; });
    else (value || []).forEach((o) => { if (o && o.id != null) nextMap[o.id] = o; });

    const ops = [];
    Object.keys(nextMap).forEach((id) => {
      const json = JSON.stringify(nextMap[id]);
      if (remoteJsonCache[key][id] !== json) ops.push({ type: "set", id, json });
    });
    Object.keys(recordCache[key]).forEach((id) => {
      if (!(id in nextMap)) ops.push({ type: "delete", id });
    });

    recordCache[key] = nextMap;
    if (!ops.length) return;

    const CHUNK = 400; // limite do Firestore é 500 operações por lote
    function commitChunk(i) {
      if (i >= ops.length) return;
      const slice = ops.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((op) => {
        const ref = doc(db, spec.col, String(op.id));
        if (op.type === "delete") batch.delete(ref);
        else batch.set(ref, { json: op.json, updatedAt: serverTimestamp() });
      });
      batch.commit().then(() => {
        slice.forEach((op) => {
          if (op.type === "delete") delete remoteJsonCache[key][op.id];
          else remoteJsonCache[key][op.id] = op.json;
        });
        commitChunk(i + CHUNK);
      }).catch((e) => console.warn("[firebaseAdapter] falha ao enviar lote de", key, e && e.message));
    }
    commitChunk(0);
  }

  function saveConfig(key, value) {
    configCache[key] = value;
    setDoc(doc(db, CONFIG_COLLECTION, key), { json: JSON.stringify(value), updatedAt: serverTimestamp() })
      .catch((e) => console.warn("[firebaseAdapter] falha ao enviar config", key, e && e.message));
  }

  function startListeners() {
    Object.keys(RECORD_SPECS).forEach((key) => {
      const spec = RECORD_SPECS[key];
      let pendingFlush = false;
      onSnapshot(collection(db, spec.col), (qs) => {
        qs.docChanges().forEach((ch) => {
          if (ch.type === "removed") {
            delete remoteJsonCache[key][ch.doc.id];
            delete recordCache[key][ch.doc.id];
          } else {
            const data = ch.doc.data() || {};
            remoteJsonCache[key][ch.doc.id] = data.json;
            try { recordCache[key][ch.doc.id] = JSON.parse(data.json); } catch { /* ignore */ }
          }
        });
        if (pendingFlush) return;
        pendingFlush = true;
        setTimeout(() => { pendingFlush = false; notify(); }, 400);
      }, (err) => console.warn("[firebaseAdapter] erro no listener", key, err && err.message));
    });
    CONFIG_KEYS.forEach((key) => {
      onSnapshot(doc(db, CONFIG_COLLECTION, key), (snap) => {
        if (snap.exists()) {
          try { configCache[key] = JSON.parse(snap.data().json); } catch { /* ignore */ }
        }
        notify();
      }, (err) => console.warn("[firebaseAdapter] erro no listener de config", key, err && err.message));
    });
  }

  startListeners();

  return {
    mode: "firebase",
    getAllRecords,
    getAllConfig,
    saveRecord,
    saveConfig,
    subscribe(onChange) { listeners.add(onChange); return () => listeners.delete(onChange); },
  };
}
