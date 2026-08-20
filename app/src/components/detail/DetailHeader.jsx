import { PartyBadge } from "../PartyBadge.jsx";
import { useData } from "../../data/DataProvider.jsx";
import {
  getTemp, tempColor, getSitAtend, getUserJourney, isManualClaim, situacaoEfetiva,
  getNextAction, isAtrasado, loadComms, isSemAtualizacao, getResponsavel, campoEfetivo,
} from "../../logic/claims";
import { fmtDateBR, txt } from "../../logic/format";

const DEFAULT_TEMP_OPTIONS = ["Tranquilo", "Moderado", "Grave", "Em atenção"];
const DEFAULT_SIT_OPTIONS = ["Aguard. Cliente", "Aguard. Seguradora", "Aguard. Corretora", "Aguard. Oficina"];

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
        </div>

        {c.observacoes && String(c.observacoes).trim() && (
          <div style={{ marginTop: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Observações (CORP)</div>
            <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "var(--ink-soft)" }}>{String(c.observacoes).trim()}</div>
          </div>
        )}
      </div>

      <div style={{ width: 280, flexShrink: 0 }}>
        <ResponsavelBox c={c} users={users} overrides={overrides} actions={actions} canEdit={canEdit} />

        {na && na.title && !atrasada && (
          <div style={{ background: "rgba(var(--brand-rgb),.08)", border: "1px solid rgba(var(--brand-rgb),.28)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: ".5px" }}>Próxima ação</div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>{na.title}</div>
            <div className="muted" style={{ fontSize: 12 }}>{na.date ? "Prazo: " + fmtDateBR(na.date) : "Sem prazo"}</div>
            <button className="btn sec xs" style={{ marginTop: 6 }} onClick={() => setDetailTab("proxima")}>Ver / editar</button>
          </div>
        )}
        {na && na.title && atrasada && (
          <div className="neon-alert" style={{ "--neon-rgb": "var(--danger-rgb)", background: "rgba(var(--danger-rgb),.1)", border: "1px solid rgba(var(--danger-rgb),.35)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", textTransform: "uppercase", letterSpacing: ".5px" }}>⚠ Próxima ação atrasada</div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>{na.title}</div>
            <div className="muted" style={{ fontSize: 12 }}>Prazo era: {fmtDateBR(na.date)}</div>
            <button className="btn sec xs" style={{ marginTop: 6 }} onClick={() => setDetailTab("proxima")}>Ver / editar</button>
          </div>
        )}
        {!(na && na.title) && (
          <div className="neon-alert" style={{ "--neon-rgb": "var(--danger-rgb)", background: "rgba(var(--danger-rgb),.08)", border: "1px solid rgba(var(--danger-rgb),.3)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", textTransform: "uppercase", letterSpacing: ".5px" }}>⚠ Sem próxima ação</div>
            <div className="muted" style={{ fontSize: 12, margin: "2px 0" }}>Nenhuma próxima ação definida.</div>
            <button className="btn xs" style={{ marginTop: 4 }} onClick={() => setDetailTab("proxima")}>+ Criar próxima ação</button>
          </div>
        )}

        <div className={semAtualizacao ? "neon-alert" : ""} style={{ "--neon-rgb": "var(--danger-rgb)", ...(semAtualizacao ? { background: "rgba(var(--danger-rgb),.08)", border: "1px solid rgba(var(--danger-rgb),.35)" } : { background: "var(--surface-2)", border: "1px solid var(--border)" }), borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: semAtualizacao ? "var(--danger)" : "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".5px" }}>
            {semAtualizacao ? "⚠ Último histórico (+3 dias sem retorno)" : "Último histórico"}
          </div>
          {last ? (
            <div>
              <div style={{ fontSize: 12, marginTop: 2 }}>
                <span className={"badge " + (last.canal === "Cliente" ? "green" : last.canal === "Oficina" ? "amber" : "purple")}>{last.canal}</span>
                <span className="muted" style={{ marginLeft: 6 }}>{last.meio} • {fmtDateBR(last.date)}</span>
              </div>
              <div style={{ fontSize: 12, marginTop: 4, maxHeight: 48, overflow: "hidden" }}>{last.text}</div>
            </div>
          ) : <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Nenhum histórico registrado.</div>}
          <button className="btn sec xs" style={{ marginTop: 6 }} onClick={() => setDetailTab("historico")}>Abrir histórico</button>
        </div>
      </div>
    </div>
  );
}
