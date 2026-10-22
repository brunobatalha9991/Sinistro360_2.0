import { useData } from "../../data/DataProvider.jsx";
import { EmptyState } from "../EmptyState.jsx";
import { setDemandaPrefill } from "../../state/taskModal";
import { fmtDateBR, fmtDateHoraBR, txt } from "../../logic/format";
import { compararTarefasAuto, isTarefaEmergencia, tarefasDoProcesso } from "../../logic/tasks";
import { labelTipoAtendimento } from "../../logic/solicitacaoPdf";

// Comunicações internas (tarefas, módulo "Comunicação interna") vinculadas
// a este processo — a pedido do usuário: o vínculo já existia no sentido
// tarefa → processo (t.processo, com o atalho "🔗 nº do sinistro" no card
// da tarefa); aqui ele aparece também dentro do processo, pra abrir a
// comunicação sem precisar procurá-la na lista de Tarefas. "Abrir" leva
// pro módulo Tarefas com a rota "open-<id>", que abre o modal da tarefa
// (o TaskModal só é montado lá — ver pages/Tarefas.jsx).
function statusCor(s) {
  if (s === "Concluído") return "green";
  if (s === "Em andamento") return "amber";
  return "blue";
}

export function ComunicacaoInternaPanel({ c, users, navigate, canCriar }) {
  const { records } = useData();
  const tarefas = tarefasDoProcesso(records.corp_tasks, c.id);
  const abertas = tarefas.filter((t) => t.status !== "Concluído").sort(compararTarefasAuto);
  const concluidas = tarefas.filter((t) => t.status === "Concluído").sort((a, b) => String(b.concludedAt || b.updatedAt || "").localeCompare(String(a.concludedAt || a.updatedAt || "")));
  const nomeUser = (id) => (users || []).find((u) => u.id === id)?.nome || "—";

  function criar() {
    setDemandaPrefill({ titulo: `Processo ${c.numsin || "#" + c.nosnum} — ${txt(c.segurado)}`, descricao: "", processoId: c.id });
    navigate("tarefas", "newfromdemanda");
  }

  function Card({ t }) {
    const emergencia = isTarefaEmergencia(t);
    const dests = (t.destinatarios || []).map(nomeUser).join(", ") || "—";
    return (
      <div
        className={"task-card " + (t.urgencia || "").toLowerCase() + (emergencia ? " neon-alert" : "")}
        style={{ marginBottom: 0, cursor: "pointer", ...(emergencia ? { "--neon-rgb": "var(--danger-rgb)" } : {}) }}
        onClick={() => navigate("tarefas", "open-" + t.id)}
        title="Abrir esta comunicação interna"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              {emergencia && <span className="badge red" style={{ fontWeight: 700 }}>EMERGÊNCIA</span>}
              {t.ci && <span className="badge gray mono" title="Número de protocolo">{t.ci}</span>}
              {t.urgencia && <span className={"badge-mini urg-badge " + (t.urgencia || "").toLowerCase()}>{t.urgencia}</span>}
              <span className="badge gray">{t.tipo}</span>
              <span className={"badge " + statusCor(t.status)}>{t.status}</span>
              {t.tipoAtendimento && <span className="badge purple">{labelTipoAtendimento(t.tipoAtendimento)}</span>}
              {t.tipo === "Mesa de Atendimento" && t.solicitacao && <span className="badge blue">Solicitação preenchida</span>}
              {t.proximaAcaoData && <span className="badge blue" title="Data prevista pra resolver">📅 {fmtDateBR(t.proximaAcaoData)}</span>}
              {(t.flags || []).map((f) => <span key={f} className="badge amber">{f}</span>)}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t.titulo || "(sem título)"}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>De {nomeUser(t.origem)} → {dests}</div>
            {t.descricao && <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{t.descricao}</div>}
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              Criada em {fmtDateHoraBR(t.createdAt)} • Última ação em {fmtDateHoraBR(t.updatedAt)}
              {t.concludedAt && <> • Concluída em {fmtDateHoraBR(t.concludedAt)}</>}
            </div>
          </div>
          <button className="btn sec xs" onClick={(e) => { e.stopPropagation(); navigate("tarefas", "open-" + t.id); }}>Abrir →</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Comunicações internas em aberto ({abertas.length})</h3>
          {canCriar && <button className="btn sec sm" onClick={criar}>+ Criar comunicação vinculada a este processo</button>}
        </div>
        <p className="muted" style={{ marginTop: 6 }}>Tarefas do módulo Comunicação interna vinculadas a este processo. Clique para abrir a comunicação.</p>
        {abertas.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {abertas.map((t) => <Card key={t.id} t={t} />)}
          </div>
        ) : (
          <div style={{ marginTop: 10 }}><EmptyState>Nenhuma comunicação interna em aberto para este processo.</EmptyState></div>
        )}
      </div>

      {concluidas.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Concluídas ({concluidas.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {concluidas.map((t) => <Card key={t.id} t={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}
