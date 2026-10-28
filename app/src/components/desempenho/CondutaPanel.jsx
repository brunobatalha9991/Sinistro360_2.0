import { useState } from "react";
import { createPortal } from "react-dom";
import { useCondutaActions } from "../../hooks/useCondutaActions";
import { TIPOS_CONDUTA, tipoConduta, fmtMinutos } from "../../logic/conduta";
import { fmtNum } from "../../logic/format";

function fmtDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Novo registro de conduta (Admin/VIP) — pode ir pra vários usuários de
// uma vez (comunicado/normativa pra equipe toda, por exemplo).
export function NovoRegistroModal({ operacionais, preSelecionados, autor, onClose }) {
  const actions = useCondutaActions();
  const [tipo, setTipo] = useState("feedback");
  const [sel, setSel] = useState(() => new Set(preSelecionados || []));
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [exigeFeedback, setExigeFeedback] = useState(false);
  const [pergunta, setPergunta] = useState("");

  function alternar(id) {
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function salvar() {
    if (!sel.size) { alert("Selecione ao menos um usuário."); return; }
    if (!titulo.trim()) { alert("Informe o título."); return; }
    actions.criarRegistros({ userIds: [...sel], tipo, titulo, texto, exigeFeedback, perguntaFeedback: pergunta, autor });
    onClose();
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div className="conduta-modal" style={{ width: 620, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Novo registro de desempenho</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        <div className="field"><label>Tipo</label>
          <div className="chips">
            {TIPOS_CONDUTA.map((t) => (
              <div key={t.key} className={"chip-btn" + (tipo === t.key ? " active" : "")} onClick={() => setTipo(t.key)}>{t.icone} {t.label}</div>
            ))}
          </div>
        </div>

        <div className="field"><label>Usuário(s)</label>
          <div className="chips">
            {operacionais.length > 1 && (
              <div className={"chip-btn" + (sel.size === operacionais.length ? " active" : "")}
                onClick={() => setSel(sel.size === operacionais.length ? new Set() : new Set(operacionais.map((u) => u.id)))}
              >Todos</div>
            )}
            {operacionais.map((u) => (
              <div key={u.id} className={"chip-btn" + (sel.has(u.id) ? " active" : "")} onClick={() => alternar(u.id)}>{u.nome}</div>
            ))}
          </div>
        </div>

        <div className="field"><label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Resumo em uma linha" />
        </div>
        <div className="field"><label>Descrição</label>
          <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Detalhe o que aconteceu, a orientação ou o comunicado" />
        </div>

        <div className="field">
          <div className="chips">
            <div className={"chip-btn" + (exigeFeedback ? " active" : "")} onClick={() => setExigeFeedback((v) => !v)}>
              {exigeFeedback ? "✓ Solicitar feedback do usuário" : "Solicitar feedback do usuário"}
            </div>
          </div>
          {exigeFeedback && (
            <input style={{ marginTop: 8 }} value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="Pergunta para o usuário (opcional) — ex.: O que vai fazer para não repetir?" />
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            A tela do usuário fica travada até ele clicar em "Ciente".{exigeFeedback ? " Com feedback solicitado, ele só libera escrevendo o feedback — a única outra opção é adiar 3 min (soneca)." : ""}
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn sec sm" onClick={onClose}>Cancelar</button>
          <button className="btn sm" onClick={salvar}>Registrar e notificar</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value, danger }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: danger ? "var(--danger)" : undefined }}>{value}</div>
    </div>
  );
}

// Indicadores + histórico de registros do usuário (perfil do Desempenho).
export function CondutaPerfilCard({ mc, users, periodoLabel, isAdminUser, onNovo }) {
  const actions = useCondutaActions();
  const nome = (id) => (users.find((u) => u.id === id) || {}).nome || "—";
  const tiposComRegistro = TIPOS_CONDUTA.filter((t) => mc.porTipo[t.key]);
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Conduta e registros ({periodoLabel})</h3>
        {isAdminUser && <button className="btn sm" onClick={onNovo}>+ Novo registro</button>}
      </div>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: 12 }}>
        Advertências, falhas, feedbacks, comunicados e demais registros feitos por Administradores/VIPs, com a confirmação de leitura do usuário.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        <Stat label="Registros" value={fmtNum(mc.total)} />
        <Stat label="Negativos" value={fmtNum(mc.negativos)} danger={mc.negativos > 0} />
        <Stat label="Sem ciente" value={fmtNum(mc.pendentesCiente)} danger={mc.pendentesCiente > 0} />
        <Stat label="Tempo médio até o ciente" value={fmtMinutos(mc.tempoMedioCienteMin)} />
        <Stat label="Feedbacks respondidos" value={`${mc.feedbacksRespondidos}/${mc.feedbacksSolicitados}`} />
        <Stat label="Sonecas" value={fmtNum(mc.sonecas)} danger={mc.sonecas >= 3} />
      </div>
      {tiposComRegistro.length > 0 && (
        <div className="chips" style={{ marginTop: 12 }}>
          {tiposComRegistro.map((t) => <span key={t.key} className={"badge " + t.badge}>{t.icone} {t.label}: {mc.porTipo[t.key]}</span>)}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {!mc.registros.length ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nenhum registro no período.</p> : mc.registros.map((r) => {
          const t = tipoConduta(r.tipo);
          return (
            <div key={r.id} className="conduta-item">
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className={"badge " + t.badge}>{t.icone} {t.label}</span>
                <b style={{ flex: 1, minWidth: 160 }}>{r.titulo}</b>
                {r.cienteAt ? <span className="badge green">✓ Ciente {fmtDataHora(r.cienteAt)}</span> : <span className="badge orange">Aguardando ciente</span>}
                {isAdminUser && (
                  <button className="btn ghost xs" onClick={() => { if (confirm(`Excluir o registro "${r.titulo}"? Ele sai dos indicadores.`)) actions.excluirRegistro(r.id); }}>Excluir</button>
                )}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Por {nome(r.autorId)} em {fmtDataHora(r.at)}{r.sonecas ? ` • ${r.sonecas} soneca(s)` : ""}</div>
              {r.texto && <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{r.texto}</div>}
              {r.exigeFeedback && (
                <div style={{ fontSize: 13, marginTop: 6, borderTop: "1px dashed var(--border)", paddingTop: 6 }}>
                  <span className="muted">Feedback{r.perguntaFeedback ? ` (${r.perguntaFeedback})` : ""}: </span>
                  {r.feedback ? <span style={{ whiteSpace: "pre-wrap" }}>{r.feedback}</span> : <i className="muted">ainda não respondido</i>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
