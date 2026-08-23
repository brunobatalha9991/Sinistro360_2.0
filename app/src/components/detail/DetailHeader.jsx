import { useState } from "react";
import { PartyBadge } from "../PartyBadge.jsx";
import { EmailViewerModal } from "../EmailViewerModal.jsx";
import { useData } from "../../data/DataProvider.jsx";
import { setDemandaPrefill } from "../../state/taskModal";
import { setComsPrefill } from "../../state/comsPrefill";
import {
  getTemp, tempColor, getSitAtend, getUserJourney, isManualClaim, situacaoEfetiva,
  getNextAction, isAtrasado, loadComms, isSemAtualizacao, getResponsavel, campoEfetivo,
  getEmailAlertas,
} from "../../logic/claims";
import { fmtDateBR, fmtDateHoraBR, txt } from "../../logic/format";

const DEFAULT_TEMP_OPTIONS = ["Tranquilo", "Moderado", "Grave", "Em atenção"];
const DEFAULT_SIT_OPTIONS = ["Aguard. Cliente", "Aguard. Seguradora", "Aguard. Corretora", "Aguard. Oficina"];

// Linha compacta de um item de acompanhamento (próxima ação, último
// histórico, e-mail identificado) — a pedido do usuário: a versão antiga
// empilhava uma caixa grande, com borda e fundo coloridos, pra cada item, o
// que deixava a coluna lateral do processo enorme. Agora os três dividem UM
// card só, cada um como uma linha compacta com uma barra de cor à esquerda
// (mesmo sinal de urgência, bem menos peso visual).
function PainelItem({ cor, titulo, acoes, children, ultimo }) {
  return (
    <div style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 10, paddingBottom: 10, marginBottom: ultimo ? 0 : 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: cor }}>{titulo}</div>
      {children}
      {acoes && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>{acoes}</div>}
    </div>
  );
}

// Compacto o bastante pra ficar lado a lado com Responsável (a pedido do
// usuário) — versão reduzida do que era um PainelItem dentro de
// "Acompanhamento"; "Ver completo"/"Transformar"/"Dispensar" continuam
// valendo, só com rótulos mais curtos pra caber na largura menor.
function EmailAlertBox({ alertas, onVer, onUsar, onDispensar }) {
  const a = alertas[0];
  return (
    <div style={{ borderRadius: 8, padding: "10px 12px", background: "rgba(var(--info-rgb),.08)", border: "1px solid rgba(var(--info-rgb),.3)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--info)", textTransform: "uppercase", letterSpacing: ".5px" }}>
        ✉ E-mail{alertas.length > 1 ? ` (${alertas.length})` : ""}
      </div>
      <div style={{ fontWeight: 600, fontSize: 12, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.assunto}>{a.assunto}</div>
      <div className="muted" style={{ fontSize: 11 }}>{txt(a.remetente)}</div>
      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
        <button className="btn sec xs" onClick={onVer}>Ver</button>
        <button className="btn xs" onClick={onUsar}>Usar</button>
        <button className="btn sec xs" onClick={onDispensar}>✕</button>
      </div>
    </div>
  );
}

function ResponsavelBox({ c, users, overrides, actions, canEdit }) {
  const atual = getResponsavel(overrides, c.id);
  return (
    <div className={"responsavel-box" + (!atual ? " needs-attention" : "")} style={{ borderRadius: 8, padding: "10px 12px", ...(atual ? { background: "var(--surface-2)", border: "1px solid var(--border)" } : {}) }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: !atual ? "var(--warn)" : "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".5px" }}>
        {!atual ? "⚠ Responsável" : "Responsável"}
      </div>
      <select
        className="inline" style={{ minWidth: 180, marginTop: 6 }} value={atual ? atual.id : ""}
        onChange={(e) => {
          if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
          const uid = e.target.value;
          const u = uid ? users.find((x) => x.id === uid) : null;
          actions.saveResponsavel(c.id, u);
          actions.logAudit(c.id, "Responsável definido", u ? u.nome : "(removido)");
        }}
      >
        <option value="">— Sem responsável —</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>)}
      </select>
    </div>
  );
}

export function DetailHeader({ c, sit, rel, claims, allClaimsRaw, overrides, users, currentUser, isAdminUser, canEdit, actions, navigate, setDetailTab }) {
  const { config, saveConfig } = useData();
  const tempOpts = config.corp_temp_options && config.corp_temp_options.length ? config.corp_temp_options : DEFAULT_TEMP_OPTIONS;
  const sitOpts = config.corp_sit_options && config.corp_sit_options.length ? config.corp_sit_options : DEFAULT_SIT_OPTIONS;
  const temp = getTemp(overrides, c.id);
  const tempClr = tempColor(temp);
  const tempUrgente = tempClr === "red" || tempClr === "amber";
  const sitAt = getSitAtend(overrides, c.id);
  const caminho = (getUserJourney(overrides, c.id) || {}).caminho;
  const numsinEf = campoEfetivo(overrides, c, "numsin");
  const seguradoEf = campoEfetivo(overrides, c, "segurado");
  const placaEf = campoEfetivo(overrides, c, "placa");
  const ciaEf = campoEfetivo(overrides, c, "cia");
  const ramoEf = campoEfetivo(overrides, c, "ramo");
  const numapoEf = campoEfetivo(overrides, c, "numapo");
  const oficinaEf = campoEfetivo(overrides, c, "oficina");

  function changeTemp(v) {
    actions.saveTemp(c.id, v);
    actions.logAudit(c.id, "Temperatura alterada", v || "(sem)");
  }
  function changeSit(v) {
    actions.saveSitAtend(c.id, v);
    actions.logAudit(c.id, "Situação de atendimento", v || "(sem)");
  }

  const na = getNextAction(overrides, c.id);
  const atrasada = isAtrasado(overrides, c);
  const comms = loadComms(overrides, c.id);
  const last = comms.length ? comms[comms.length - 1] : null;
  const semAtualizacao = isSemAtualizacao(overrides, c);
  const situacaoEfe = situacaoEfetiva(overrides, c);
  const emailAlertas = getEmailAlertas(overrides, c.id);
  const [emailAberto, setEmailAberto] = useState(null);

  // "Transformar em atualização" (a pedido do usuário): nunca grava nada
  // sozinho — só pré-preenche a caixa "Comunicação com o Cliente" do
  // Histórico com o conteúdo do e-mail, pra revisão/edição antes de salvar.
  function usarEmailComoAtualizacao(alerta) {
    setComsPrefill({
      claimId: c.id,
      texto: `[E-mail de ${alerta.remetente} em ${fmtDateHoraBR(alerta.recebidoEm)}]\nAssunto: ${alerta.assunto}\n\n${alerta.corpoTexto}`,
    });
    setDetailTab("historico");
  }

  return (
    <div className="detail-head" style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <button className="btn sec sm" style={{ marginBottom: 12 }} onClick={() => navigate("sinistros")}>← Voltar aos sinistros</button>
        <h1>{(numsinEf ? "Sinistro " + numsinEf : "Registro #" + c.nosnum) + " — " + txt(seguradoEf)}</h1>
        <div className="sub">Placa {txt(placaEf)} • {txt(ciaEf)} • Ramo {txt(ramoEf)} • Apólice {txt(numapoEf)} • Oficina {txt(oficinaEf)}</div>

        <div className="detail-badges" style={{ alignItems: "center" }}>
          <PartyBadge pt={c.partyType} />
          {isManualClaim(c) && <span className="badge purple" title={"Criado por " + (c.criadoPor || "—")}>✎ Criado manualmente</span>}
          <span className={"badge " + situacaoEfe.cls}>{situacaoEfe.label}</span>
          {rel.length ? <span className="badge purple">{rel.length} processo(s) vinculado(s)</span> : <span className="badge gray">Sem vínculos</span>}
        </div>

        <div className="detail-badges" style={{ alignItems: "center", marginTop: 8 }}>
          <span className="badge chip-live blue" style={{ gap: 6 }}>
            <select className="inline" value={sitAt} onChange={(e) => changeSit(e.target.value)}>
              <option value="">Situação...</option>
              {sitOpts.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
            {isAdminUser && (
              <span style={{ display: "inline-flex", gap: 4, marginLeft: 4 }}>
                <button className="btn sec xs" title="Adicionar" onClick={() => { const v = prompt("Nova situação:"); if (v) saveConfig("corp_sit_options", (cur) => [...(cur && cur.length ? cur : DEFAULT_SIT_OPTIONS), v.trim()]); }}>+</button>
                <button className="btn sec xs" title="Editar atual" onClick={() => { if (!sitAt) { alert("Selecione uma situação para editar."); return; } const nv = prompt("Editar situação:", sitAt); if (nv) { saveConfig("corp_sit_options", (cur) => (cur && cur.length ? cur : DEFAULT_SIT_OPTIONS).map((x) => (x === sitAt ? nv.trim() : x))); changeSit(nv.trim()); } }}>✎</button>
                <button className="btn sec xs" title="Remover atual" onClick={() => { if (!sitAt) { alert("Selecione uma situação para remover."); return; } if (confirm(`Remover "${sitAt}" da lista?`)) { saveConfig("corp_sit_options", (cur) => (cur && cur.length ? cur : DEFAULT_SIT_OPTIONS).filter((x) => x !== sitAt)); changeSit(""); } }}>✕</button>
              </span>
            )}
          </span>

          <span className={"badge chip-live " + tempClr + (tempUrgente ? " neon-alert" : "")} style={{ gap: 6, ...(tempUrgente ? { "--neon-rgb": "var(--danger-rgb)" } : {}) }} title={tempUrgente ? "Atendimento requer atenção" : ""}>
            <select className="inline" value={temp} onChange={(e) => changeTemp(e.target.value)}>
              <option value="">🌡 Atendimento...</option>
              {tempOpts.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
            {isAdminUser && (
              <span style={{ display: "inline-flex", gap: 4, marginLeft: 4 }}>
                <button className="btn sec xs" title="Adicionar opção" onClick={() => { const v = prompt("Nova temperatura:"); if (v) saveConfig("corp_temp_options", (cur) => [...(cur && cur.length ? cur : DEFAULT_TEMP_OPTIONS), v.trim()]); }}>+</button>
                <button className="btn sec xs" title="Editar opção atual" onClick={() => { if (!temp) { alert("Selecione uma temperatura para editar."); return; } const nv = prompt("Editar temperatura:", temp); if (nv) { saveConfig("corp_temp_options", (cur) => (cur && cur.length ? cur : DEFAULT_TEMP_OPTIONS).map((x) => (x === temp ? nv.trim() : x))); changeTemp(nv.trim()); } }}>✎</button>
                <button className="btn sec xs" title="Remover opção atual" onClick={() => { if (!temp) { alert("Selecione uma temperatura para remover."); return; } if (confirm(`Remover a opção "${temp}" da lista?`)) { saveConfig("corp_temp_options", (cur) => (cur && cur.length ? cur : DEFAULT_TEMP_OPTIONS).filter((x) => x !== temp)); changeTemp(""); } }}>✕</button>
              </span>
            )}
          </span>

          {caminho ? <span className={"badge " + (caminho === "integral" ? "red" : "blue")}>{caminho === "integral" ? "Perda Integral" : "Perda Parcial"}</span> : <span className="badge gray">Caminho não definido</span>}
        </div>

        {c.observacoes && String(c.observacoes).trim() && (
          <div style={{ marginTop: 12, maxWidth: 520, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Observações (CORP)</div>
            <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "var(--ink-soft)" }}>{String(c.observacoes).trim()}</div>
          </div>
        )}
      </div>

      <div style={{ width: 320, flexShrink: 0 }}>
        {emailAlertas.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <EmailAlertBox
              alertas={emailAlertas}
              onVer={() => setEmailAberto(emailAlertas[0])}
              onUsar={() => usarEmailComoAtualizacao(emailAlertas[0])}
              onDispensar={() => actions.dismissEmailAlerta(c.id, emailAlertas[0].emailId)}
            />
            <ResponsavelBox c={c} users={users} overrides={overrides} actions={actions} canEdit={canEdit} />
          </div>
        ) : (
          <ResponsavelBox c={c} users={users} overrides={overrides} actions={actions} canEdit={canEdit} />
        )}

        <button
          className="btn sec xs" style={{ marginTop: 8, width: "100%" }}
          onClick={() => {
            setDemandaPrefill({ titulo: `Processo ${numsinEf || "#" + c.nosnum} — ${txt(seguradoEf)}`, descricao: "", processoId: c.id });
            navigate("tarefas", "newfromdemanda");
          }}
        >
          + Criar tarefa vinculada a este processo
        </button>

        <div className="card" style={{ padding: 14, marginTop: 10 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)" }}>
            Acompanhamento
          </h4>

          <PainelItem
            cor={atrasada ? "var(--danger)" : na && na.title ? "var(--brand)" : "var(--danger)"}
            titulo={atrasada ? "⚠ Próxima ação atrasada" : na && na.title ? "Próxima ação" : "⚠ Sem próxima ação"}
            acoes={<button className="btn sec xs" onClick={() => setDetailTab("proxima")}>{na && na.title ? "Ver / editar" : "+ Criar"}</button>}
          >
            {na && na.title ? (
              <>
                <div style={{ fontWeight: 600, fontSize: 12.5, marginTop: 2 }}>{na.title}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>{atrasada ? "Prazo era: " + fmtDateBR(na.date) : (na.date ? "Prazo: " + fmtDateBR(na.date) : "Sem prazo")}</div>
              </>
            ) : (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Nenhuma próxima ação definida.</div>
            )}
          </PainelItem>

          <PainelItem
            cor={semAtualizacao ? "var(--danger)" : "var(--ink-soft)"}
            titulo={semAtualizacao ? "⚠ Último histórico (+3 dias)" : "Último histórico"}
            acoes={<button className="btn sec xs" onClick={() => setDetailTab("historico")}>Abrir histórico</button>}
            ultimo
          >
            {last ? (
              <>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  <span className={"badge " + (last.canal === "Cliente" ? "green" : last.canal === "Oficina" ? "amber" : "purple")}>{last.canal}</span>
                  <span className="muted" style={{ marginLeft: 6 }}>{last.meio} • {fmtDateBR(last.date)}</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 4, maxHeight: 40, overflow: "hidden" }}>{last.text}</div>
              </>
            ) : <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Nenhum histórico registrado.</div>}
          </PainelItem>
        </div>
      </div>

      <EmailViewerModal email={emailAberto} onClose={() => setEmailAberto(null)} />
    </div>
  );
}
