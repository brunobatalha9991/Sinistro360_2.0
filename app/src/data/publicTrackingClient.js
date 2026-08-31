// Leitura MÍNIMA do link de acompanhamento público — deliberadamente
// separada do resto de data/ (DataProvider/firebaseAdapter carregam TODAS
// as coleções do sistema pra qualquer visitante, autenticado ou não; ver
// App.jsx). A página pública (PublicTrackingPage.jsx) nunca deve passar
// por esse caminho: ela só pode enxergar o documento único do próprio
// token, nunca o resto do banco.
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { readFirebaseConfigFromEnv, firebaseEnvConfigured } from "./firebaseAdapter";

let appInstance = null;
function getPublicApp() {
  if (!appInstance) appInstance = initializeApp(readFirebaseConfigFromEnv(), "public-tracking");
  return appInstance;
}

// Retorna o resumo curado (ver logic/publicTracking.js) ou null quando o
// token não existe/nunca foi gerado. Não lança erro pra "não encontrado" —
// só pra falha real de configuração/rede, que a tela trata separadamente.
export async function fetchPublicTracking(token) {
  if (!firebaseEnvConfigured()) throw new Error("Este ambiente não está configurado para o modo online.");
  const db = getFirestore(getPublicApp());
  const snap = await getDoc(doc(db, "s360_public_tracking", String(token)));
  if (!snap.exists()) return null;
  try {
    return JSON.parse(snap.data().json);
  } catch {
    return null;
  }
}
