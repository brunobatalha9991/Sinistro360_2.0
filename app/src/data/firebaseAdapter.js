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
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, onSnapshot, serverTimestamp, collection, writeBatch,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
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
  // Cache persistente (IndexedDB) — bug relatado 2026-10-19: dois processos
  // criados na Abertura apareceram na tela mas nunca chegaram ao servidor
  // (a aba tinha perdido a conexão com o Firestore); como as gravações
  // pendentes ficavam só na memória, ao atualizar a página elas se
  // perderam. Com o cache persistente, a gravação pendente sobrevive ao
  // recarregamento e é enviada assim que a conexão voltar. Se o navegador
  // não suportar (ex.: aba anônima sem IndexedDB), cai pro modo antigo.
  let db;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    console.warn("[firebaseAdapter] cache persistente indisponível — usando memória.", e && e.message);
    db = getFirestore(app);
  }

  // Login anônimo do Firebase — NÃO é o login do sistema (a tela de
  // e-mail/senha continua sendo a mesma, própria do app). É só uma
  // credencial técnica que as regras de segurança do Firestore passam a
  // exigir (request.auth != null), pra bloquear acesso direto de fora do
  // site. Não trava o carregamento dos dados abaixo: os listeners começam
  // de qualquer forma, então enquanto o método "Anônimo" não estiver
  // habilitado no Console (Authentication > Sign-in method), o app
  // continua funcionando exatamente como antes desta mudança.
  const auth = getAuth(app);
  function loginAnonimo() {
    return signInAnonymously(auth).catch((e) => {
      console.warn(
        "[firebaseAdapter] login anônimo falhou — habilite 'Anônimo' em Authentication > Sign-in method no Console do Firebase.",
        e && e.message
      );
      throw e;
    });
  }
  loginAnonimo().catch(() => { /* já avisado */ });
  // Bug relatado 2026-10-19 ("Missing or insufficient permissions"): o
  // login anônimo só era feito uma vez, ao abrir a página. Se ele caísse
  // com a aba aberta (token não renovado, conta anônima removida), toda
  // gravação passava a ser recusada até alguém dar F5 — e o que tinha sido
  // feito nesse meio-tempo se perdia. Agora o login é refeito sozinho
  // sempre que cair, e uma gravação recusada por permissão é repetida uma
  // vez depois de renovar a credencial (ver renovarCredencial abaixo).
  onAuthStateChanged(auth, (u) => {
    if (!u) loginAnonimo().catch(() => { /* já avisado */ });
  });
  function renovarCredencial() {
    if (auth.currentUser) return auth.currentUser.getIdToken(true).catch(() => loginAnonimo());
    return loginAnonimo();
  }
  function ehErroPermissao(e) { return !!(e && e.code === "permission-denied"); }

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

  // Situação das gravações (a pedido do usuário, mesmo bug acima): antes,
  // uma falha só ia pro console e ninguém ficava sabendo. Agora o App
  // mostra um aviso enquanto houver gravação pendente/com erro, e o
  // navegador pede confirmação antes de fechar/atualizar a página.
  const syncStatus = { pending: 0, pendingSince: null, error: null };
  function writeStarted() {
    if (!syncStatus.pending) syncStatus.pendingSince = Date.now();
    syncStatus.pending++;
    notify();
  }
  function writeFinished(err) {
    syncStatus.pending = Math.max(0, syncStatus.pending - 1);
    if (!syncStatus.pending) syncStatus.pendingSince = null;
    syncStatus.error = err ? ((err && err.message) || String(err)) : (syncStatus.pending ? syncStatus.error : null);
    notify();
  }
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", (ev) => {
      // Só pede confirmação com gravação ainda pendente — com erro, a
      // gravação já foi recusada e atualizar a página é justamente a saída.
      if (!syncStatus.pending) return;
      ev.preventDefault();
      ev.returnValue = "";
    });
  }

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
    function enviarLote(slice) {
      const batch = writeBatch(db);
      slice.forEach((op) => {
        const ref = doc(db, spec.col, String(op.id));
        if (op.type === "delete") batch.delete(ref);
        else batch.set(ref, { json: op.json, updatedAt: serverTimestamp() });
      });
      return batch.commit();
    }
    function commitChunk(i) {
      if (i >= ops.length) return;
      const slice = ops.slice(i, i + CHUNK);
      writeStarted();
      enviarLote(slice).catch((e) => {
        if (!ehErroPermissao(e)) throw e;
        return renovarCredencial().then(() => enviarLote(slice));
      }).then(() => {
        slice.forEach((op) => {
          if (op.type === "delete") delete remoteJsonCache[key][op.id];
          else remoteJsonCache[key][op.id] = op.json;
        });
        writeFinished(null);
        commitChunk(i + CHUNK);
      }).catch((e) => {
        console.warn("[firebaseAdapter] falha ao enviar lote de", key, e && e.message);
        writeFinished(e || new Error("falha ao gravar"));
      });
    }
    commitChunk(0);
  }

  function saveConfig(key, value) {
    configCache[key] = value;
    writeStarted();
    const enviar = () => setDoc(doc(db, CONFIG_COLLECTION, key), { json: JSON.stringify(value), updatedAt: serverTimestamp() });
    enviar()
      .catch((e) => {
        if (!ehErroPermissao(e)) throw e;
        return renovarCredencial().then(enviar);
      })
      .then(() => writeFinished(null))
      .catch((e) => {
        console.warn("[firebaseAdapter] falha ao enviar config", key, e && e.message);
        writeFinished(e || new Error("falha ao gravar"));
      });
  }

  function startListeners() {
    // Um listener que recebe erro do Firestore para de vez — se foi por
    // permissão (login anônimo caiu), renova a credencial e escuta de novo,
    // senão a tela deixa de receber as alterações dos outros usuários.
    function reescutarDepois(err, iniciar) {
      if (!ehErroPermissao(err)) return;
      setTimeout(() => { renovarCredencial().catch(() => {}).then(iniciar); }, 3000);
    }
    Object.keys(RECORD_SPECS).forEach((key) => {
      const spec = RECORD_SPECS[key];
      let pendingFlush = false;
      const iniciar = () => onSnapshot(collection(db, spec.col), (qs) => {
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
      }, (err) => {
        console.warn("[firebaseAdapter] erro no listener", key, err && err.message);
        reescutarDepois(err, iniciar);
      });
      iniciar();
    });
    CONFIG_KEYS.forEach((key) => {
      const iniciar = () => onSnapshot(doc(db, CONFIG_COLLECTION, key), (snap) => {
        if (snap.exists()) {
          try { configCache[key] = JSON.parse(snap.data().json); } catch { /* ignore */ }
        }
        notify();
      }, (err) => {
        console.warn("[firebaseAdapter] erro no listener de config", key, err && err.message);
        reescutarDepois(err, iniciar);
      });
      iniciar();
    });
  }

  startListeners();

  return {
    mode: "firebase",
    getAllRecords,
    getAllConfig,
    getSyncStatus() { return { ...syncStatus }; },
    saveRecord,
    saveConfig,
    subscribe(onChange) { listeners.add(onChange); return () => listeners.delete(onChange); },
  };
}
