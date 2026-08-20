import { Fragment, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { useStore } from "../hooks/useStore";
import { demandaFilterStore } from "../state/demandaFilter";
import { setDemandaPrefill } from "../state/taskModal";
import { EmptyState } from "../components/EmptyState.jsx";
import { isAdmin } from "../data/auth";

const FORM_SLOTS = 7;

function fetchFormResponses(url) {
  if (!url) return Promise.resolve([]);
  return fetch(url).then((r) => r.text()).then((txt) => {
    let d;
    try { d = JSON.parse(txt); } catch { throw new Error("Resposta do formulário não é um JSON válido. Confira o link do Apps Script."); }
    return Array.isArray(d) ? d : d.respostas || d.responses || d.data || d.itens || [];
  });
}
function respId(formKey, raw) {
  const base = raw.id || raw.responseId || raw.timestamp || raw.data || JSON.stringify(raw.campos || raw.fields || raw);
  return "dem_" + formKey + "_" + String(base).replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
}
function respCampos(raw) { return raw.campos || raw.fields || raw.answers || raw.respostas || raw; }

export function Demandas() {
  const { records, config, saveRecord, saveConfig } = useData();
  const { navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const dfil = useStore(demandaFilterStore);
  const [status, setStatus] = useState(null);
  const cfg = config.corp_form_endpoints || {};
  const [formInputs, setFormInputs] = useState(() => {
    const init = {};
    for (let n = 1; n <= FORM_SLOTS; n++) { init["nome" + n] = cfg["nome" + n] || ""; init["url" + n] = cfg["url" + n] || ""; }
    return init;
  });
  const users = records.corp_users || [];
  let demandas = [...(records.corp_demandas || [])].sort((a, b) => String(b.recebidoEm).localeCompare(String(a.recebidoEm)));

  // A busca nos formulários pode levar segundos (rede). Nesse intervalo,
  // outra sincronização (sua ou de outro admin) pode ter mudado a lista de
  // demandas — por isso o merge final acontece dentro do updater do
  // saveRecord, lendo o estado mais recente na hora de gravar, e não um
  // retrato de antes da espera pela rede.
  function syncDemandas() {
    setStatus({ cls: "info", spinning: true, msg: "Buscando respostas..." });
    const newItems = {};
    let chain = Promise.resolve();
    for (let n = 1; n <= FORM_SLOTS; n++) {
      const url = cfg["url" + n];
      const nome = cfg["nome" + n] || `Formulário ${n}`;
      const formKey = "f" + n;
      if (!url) continue;
      chain = chain.then(() => fetchFormResponses(url).then((arr) => {
        (arr || []).forEach((raw) => {
          const id = respId(formKey, raw);
          newItems[id] = { id, formKey, formNome: nome, campos: respCampos(raw), recebidoEm: new Date().toISOString(), lida: false, timestamp: raw.timestamp || raw.data || "" };
        });
      }).catch(() => { /* se um form falhar, os outros continuam */ }));
    }
    chain.then(() => {
      let novos = 0, total = 0;
      saveRecord("corp_demandas", (current) => {
        const byId = {};
        (current || []).forEach((d) => { byId[d.id] = d; });
        Object.keys(newItems).forEach((id) => { if (!byId[id]) { byId[id] = newItems[id]; novos++; } });
        const lista = Object.values(byId);
        total = lista.length;
        return lista;
      });
      if (novos > 0) {
        const todos = users.map((u) => u.id);
        saveRecord("corp_notifs", (current) => {
          const arr = [...(current || [])];
          todos.forEach((uid) => arr.push({ id: "ntf_" + Math.random().toString(36).slice(2, 9), taskId: "__demanda__", userId: uid, text: `${novos} nova(s) demanda(s) recebida(s) de formulário`, at: new Date().toISOString(), read: false }));
          return arr;
        });
      }
      setStatus({ cls: "ok", msg: `✔ ${novos} nova(s) demanda(s). Total: ${total}.` });
    }).catch((e) => setStatus({ cls: "err", msg: "✗ " + e.message }));
  }

  function marcarLida(id, lida) {
    saveRecord("corp_demandas", (current) => (current || []).map((x) => (x.id === id ? { ...x, lida } : x)));
  }
  function remover(id) {
    if (!confirm("Remover esta demanda?")) return;
    saveRecord("corp_demandas", (current) => (current || []).filter((x) => x.id !== id));
  }
  function criarTarefa(d) {
    marcarLida(d.id, true);
    const campos = d.campos || {};
    const resumo = Object.keys(campos).map((k) => `${k}: ${campos[k]}`).join("\n");
    setDemandaPrefill({ titulo: `Demanda — ${d.formNome || "Formulário"}`, descricao: resumo });
    navigate("tarefas", "newfromdemanda");
  }

  demandas = demandas.filter((d) => {
    if (dfil.status === "nao" && d.lida) return false;
    if (dfil.status === "lida" && !d.lida) return false;
    if (dfil.origem !== "todos" && d.formKey !== dfil.origem) return false;
    if (dfil.q && dfil.q.trim()) {
      if (JSON.stringify(d.campos || {}).toLowerCase().indexOf(dfil.q.trim().toLowerCase()) < 0) return false;
    }
    return true;
  });

  function salvarVinculos() {
    saveConfig("corp_form_endpoints", (current) => {
      const novoCfg = { ...(current || {}) };
      for (let n = 1; n <= FORM_SLOTS; n++) {
        novoCfg["url" + n] = (formInputs["url" + n] || "").trim();
        novoCfg["nome" + n] = (formInputs["nome" + n] || "").trim() || `Formulário ${n}`;
      }
      return novoCfg;
    });
    setStatus({ cls: "ok", msg: "Vínculos salvos." });
  }

  const formOptions = [];
  for (let n = 1; n <= FORM_SLOTS; n++) { if (cfg["url" + n]) formOptions.push(["f" + n, cfg["nome" + n] || `Formulário ${n}`]); }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Nova Demanda</h1><p>Demandas recebidas dos formulários externos</p></div>
        <button className="btn" onClick={syncDemandas}>↻ Sincronizar formulários</button>
      </div>

      {isAdmin(currentUser) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Vínculos com os formulários (admin) — até {FORM_SLOTS}</h3>
          <p className="muted">Cole o link /exec gerado pelo Google Apps Script de cada formulário. Deixe em branco os que não usar.</p>
          {Array.from({ length: FORM_SLOTS }, (_, i) => i + 1).map((n) => (
            <div className="grid c2" style={{ marginBottom: 4 }} key={n}>
              <div className="field"><label>Nome do Formulário {n}</label>
                <input value={formInputs["nome" + n]} placeholder={`Nome do Formulário ${n}`} onChange={(e) => setFormInputs((s) => ({ ...s, ["nome" + n]: e.target.value }))} />
              </div>
              <div className="field"><label>Link do Formulário {n}</label>
                <input value={formInputs["url" + n]} placeholder={`Link do Apps Script (/exec) do Formulário ${n}`} onChange={(e) => setFormInputs((s) => ({ ...s, ["url" + n]: e.target.value }))} />
              </div>
            </div>
          ))}
          <button className="btn" onClick={salvarVinculos}>Salvar vínculos</button>
        </div>
      )}

      {status && <div className={"status " + status.cls}>{status.msg}{status.spinning ? <span className="spin" /> : null}</div>}

      <div className="chips" style={{ alignItems: "center" }}>
        <select className="inline" style={{ minWidth: 150 }} value={dfil.status} onChange={(e) => demandaFilterStore.patch({ status: e.target.value })}>
          <option value="todas">Todas as leituras</option>
          <option value="nao">Não lidas</option>
          <option value="lida">Lidas</option>
        </select>
        <select className="inline" style={{ minWidth: 170 }} value={dfil.origem} onChange={(e) => demandaFilterStore.patch({ origem: e.target.value })}>
          <option value="todos">Todos os formulários</option>
          {formOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <input className="inline" style={{ minWidth: 220 }} placeholder="Buscar na demanda..." value={dfil.q || ""} onChange={(e) => demandaFilterStore.patch({ q: e.target.value })} />
      </div>

      {!demandas.length ? (
        <div className="card"><EmptyState>Nenhuma demanda recebida ainda. Configure os formulários e clique em Sincronizar.</EmptyState></div>
      ) : demandas.map((d) => {
        const campos = d.campos || {};
        const dt = new Date(d.recebidoEm);
        const when = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        return (
          <div key={d.id} className={"demanda-card" + (d.lida ? "" : " nova")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="badge blue">{d.formNome || "Formulário"}</span>
                  {d.lida ? <span className="badge gray">Lida</span> : <span className="badge red">● Nova</span>}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Recebida em {when}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn xs" onClick={() => criarTarefa(d)}>→ Criar tarefa</button>
                {!d.lida && <button className="btn sec xs" onClick={() => marcarLida(d.id, true)}>Marcar lida</button>}
                <button className="btn danger xs" onClick={() => remover(d.id)}>Remover</button>
              </div>
            </div>
            <dl className="demanda-kv">
              {Object.keys(campos).map((k) => (
                <Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{campos[k] == null ? "—" : String(campos[k])}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
