import { describe, it, expect, vi, beforeEach } from "vitest";

// Firestore/Auth simulados: cada batch.commit() fica pendente até o teste
// confirmar (ack) ou recusar — assim dá pra reproduzir confirmação fora de
// ordem e gravação em laço, os dois bugs de 2026-10-19.
const h = vi.hoisted(() => ({ commits: [], setDocs: [], snapshotCbs: {} }));

vi.mock("firebase/app", () => ({ initializeApp: () => ({}) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: { getIdToken: () => Promise.resolve("t") } }),
  signInAnonymously: () => Promise.resolve(),
  onAuthStateChanged: () => () => {},
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  serverTimestamp: () => "ts",
  collection: (_db, col) => ({ col }),
  doc: (_db, col, id) => ({ col, id }),
  onSnapshot: (ref, cb) => { h.snapshotCbs[ref.col + (ref.id ? "/" + ref.id : "")] = cb; return () => {}; },
  setDoc: (ref, data) => new Promise((resolve, reject) => { h.setDocs.push({ ref, data, resolve, reject }); }),
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, data) => ops.push({ type: "set", id: ref.id, json: data.json }),
      delete: (ref) => ops.push({ type: "delete", id: ref.id }),
      commit: () => new Promise((resolve, reject) => { h.commits.push({ ops, resolve, reject }); }),
    };
  },
}));

const { createFirebaseAdapter } = await import("./firebaseAdapter.js");
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("firebaseAdapter — proteção contra gravação repetida", () => {
  let a;
  beforeEach(() => {
    h.commits.length = 0; h.setDocs.length = 0;
    a = createFirebaseAdapter();
  });

  it("não reenvia conteúdo idêntico enquanto a gravação ainda está pendente", () => {
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    expect(h.commits.length).toBe(1);
  });

  it("confirmação de gravação antiga (fora de ordem) não provoca reenvio", async () => {
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    a.saveRecord("corp_public_tracking", { tok: { x: 2 } });
    expect(h.commits.length).toBe(2);
    h.commits[0].resolve(); // confirma a ANTIGA (x:1) depois de x:2 enviado
    await flush();
    a.saveRecord("corp_public_tracking", { tok: { x: 2 } });
    expect(h.commits.length).toBe(2);
  });

  it("depois de recusada, o mesmo conteúdo pode ser enviado de novo", async () => {
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    h.commits[0].reject(Object.assign(new Error("offline"), { code: "unavailable" }));
    await flush();
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    expect(h.commits.length).toBe(2);
  });

  it("alteração de outro usuário libera regravar o valor que eu tinha enviado", async () => {
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    h.commits[0].resolve();
    await flush();
    h.snapshotCbs["s360_public_tracking"]({
      docChanges: () => [{ type: "modified", doc: { id: "tok", data: () => ({ json: JSON.stringify({ x: 9 }) }) } }],
    });
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    expect(h.commits.length).toBe(2);
  });

  it("disjuntor bloqueia um registro gravado em laço e avisa", () => {
    for (let i = 0; i < 300; i++) a.saveRecord("corp_public_tracking", { tok: { x: i } });
    expect(h.commits.length).toBe(120);
    expect(a.getSyncStatus().error).toMatch(/repetidas bloqueadas/);
  });

  it("saveConfig também não reenvia conteúdo idêntico", () => {
    a.saveConfig("corp_cfg", { a: 1 });
    a.saveConfig("corp_cfg", { a: 1 });
    expect(h.setDocs.length).toBe(1);
  });

  it("gravação pendente aparece no status e some ao confirmar", async () => {
    a.saveRecord("corp_public_tracking", { tok: { x: 1 } });
    expect(a.getSyncStatus().pending).toBe(1);
    h.commits[0].resolve();
    await flush();
    expect(a.getSyncStatus().pending).toBe(0);
  });
});
