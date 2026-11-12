import { useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { useTasksActions } from "../hooks/useTasksActions";
import { myNotifs } from "../logic/tasks";
import { EmptyState } from "../components/EmptyState.jsx";
import { NotifLista } from "../components/NotifBell.jsx";
import { CATEGORIAS_NOTIF, categoriaNotif } from "../logic/notificacoes";

const LEITURA_CHIPS = [["todas", "Todas"], ["nao_lidas", "Não lidas"], ["lidas", "Lidas"]];
const PASSO = 50;

// Módulo Notificações (a pedido do usuário) — histórico completo do sino,
// com filtros, para quando as notificações acumulam. Aberto pelo "Ver
// todas" do sino; vale para todos os perfis (não depende de permissão de
// módulo, ver resolveAllowedRoute).
//
// Seleção em lote (a pedido do usuário): marcar à mão (caixa em cada card)
// ou todas do filtro atual, e então marcar como lida/não lida ou apagar só
// as marcadas. Trocar o filtro limpa a seleção, pra nenhuma ação cair em
// notificação que não está à vista.
export function Notificacoes() {
  const { records } = useData();
  const { currentUser } = useAuth();
  const actions = useTasksActions();
  const [leitura, setLeitura] = useState("todas");
  const [categoria, setCategoria] = useState("todas");
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState(PASSO);
  const [selecao, setSelecao] = useState(() => new Set());

  const todas = myNotifs(records.corp_notifs || [], currentUser);
  const naoLidas = todas.filter((n) => !n.read).length;
  const termo = q.trim().toLowerCase();
  const filtradas = todas
    .filter((n) => (leitura === "nao_lidas" ? !n.read : leitura === "lidas" ? n.read : true))
    .filter((n) => categoria === "todas" || categoriaNotif(n) === categoria)
    .filter((n) => !termo || String(n.text || "").toLowerCase().indexOf(termo) >= 0);
  const visiveis = filtradas.slice(0, limite);

  // Só conta o que ainda existe na lista (apagadas somem sozinhas).
  const marcadas = filtradas.filter((n) => selecao.has(n.id));
  const idsMarcados = marcadas.map((n) => n.id);
  const todasDoFiltroMarcadas = filtradas.length > 0 && marcadas.length === filtradas.length;

  function mudar(fn) { return (v) => { fn(v); setLimite(PASSO); setSelecao(new Set()); }; }

  function alternarSelecao(id) {
    setSelecao((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function marcarTodasDoFiltro() {
    setSelecao(todasDoFiltroMarcadas ? new Set() : new Set(filtradas.map((n) => n.id)));
  }
  function marcarLidas(lida) {
    actions.marcarNotifsLidas(idsMarcados, lida);
    setSelecao(new Set());
  }
  function apagar() {
    const qtd = idsMarcados.length;
    if (!qtd) return;
    if (!confirm(`Apagar ${qtd} notificação(ões) marcada(s)? Elas somem da sua lista.`)) return;
    actions.apagarNotifs(idsMarcados);
    setSelecao(new Set());
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Notificações</h1><p>{todas.length} no total • {naoLidas} não lida{naoLidas === 1 ? "" : "s"}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sec" disabled={!naoLidas} onClick={() => actions.markAllNotifsRead()}>Marcar todas lidas</button>
        </div>
      </div>

      <div className="card">
        <div className="chips" style={{ alignItems: "center" }}>
          {LEITURA_CHIPS.map(([k, label]) => (
            <div key={k} className={"chip-btn" + (leitura === k ? " active" : "")} onClick={() => mudar(setLeitura)(k)}>{label}</div>
          ))}
          <select className="inline" style={{ width: "auto" }} value={categoria} onChange={(e) => mudar(setCategoria)(e.target.value)}>
            <option value="todas">Todos os tipos</option>
            {CATEGORIAS_NOTIF.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input className="inline" style={{ minWidth: 200 }} placeholder="Buscar no texto..." value={q} onChange={(e) => mudar(setQ)(e.target.value)} />
        </div>
        <div className="notif-acoes-lote" style={{ marginTop: 10 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: filtradas.length ? "pointer" : "default", margin: 0 }}>
            <input type="checkbox" checked={todasDoFiltroMarcadas} disabled={!filtradas.length} onChange={marcarTodasDoFiltro} />
            <span>Marcar todas do filtro ({filtradas.length})</span>
          </label>
          <span className="muted" style={{ fontSize: 12 }}>{marcadas.length} marcada{marcadas.length === 1 ? "" : "s"}</span>
          <button type="button" className="btn sec sm" disabled={!marcadas.length} onClick={() => marcarLidas(true)}>Marcar como lida</button>
          <button type="button" className="btn sec sm" disabled={!marcadas.length} onClick={() => marcarLidas(false)}>Marcar como não lida</button>
          <button type="button" className="btn danger sm" disabled={!marcadas.length} onClick={apagar}>Apagar</button>
          {marcadas.length > 0 && (
            <button type="button" className="btn ghost sm" onClick={() => setSelecao(new Set())}>Limpar seleção</button>
          )}
        </div>
      </div>

      <div className="card notif-pagina">
        {!visiveis.length ? <EmptyState>Nenhuma notificação neste filtro.</EmptyState> : (
          <NotifLista list={visiveis} selecao={selecao} onAlternarSelecao={alternarSelecao} />
        )}
        {filtradas.length > visiveis.length && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button type="button" className="btn sec sm" onClick={() => setLimite((l) => l + PASSO)}>
              Carregar mais ({filtradas.length - visiveis.length} restante{filtradas.length - visiveis.length > 1 ? "s" : ""})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
