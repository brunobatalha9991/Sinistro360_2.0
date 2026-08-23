import { useState } from "react";
import { PartyBadge } from "../PartyBadge.jsx";
import { EmailViewerModal } from "../EmailViewerModal.jsx";
import { HeaderLayoutGrid } from "./HeaderLayoutGrid.jsx";
import { useData } from "../../data/DataProvider.jsx";
import { setDemandaPrefill } from "../../state/taskModal";
import { setComsPrefill } from "../../state/comsPrefill";
import { getGmailToken } from "../../gmail/googleAuthClient";
import { baixarAnexoGmail } from "../../logic/gmailApi";
import {
  getTemp, tempColor, getSitAtend, getUserJourney, isManualClaim, situacaoEfetiva,
  getNextAction, isAtrasado, loadComms, isSemAtualizacao, getResponsavel, campoEfetivo,
  campoFoiEditado, getEmailAlertas,
} from "../../logic/claims";
import { fmtDateBR, fmtDateHoraBR, txt } from "../../logic/format";

const DEFAULT_TEMP_OPTIONS = ["Tranquilo", "Moderado", "Grave", "Em atenção"];
const DEFAULT_SIT_OPTIONS = ["Aguard. Cliente", "Aguard. Seguradora", "Aguard. Corretora", "Aguard. Oficina"];

// Ordem padrão das caixas do cabeçalho do processo — usada até alguém
// reorganizar (então o layout combinado fica salvo em
// config.corp_detail_layout, compartilhado pra todo mundo). IDs novos que
// não existirem ainda num layout salvo entram no fim, então uma caixa nova
// no futuro nunca fica escondida por um layout salvo antigo.
const DEFAULT_LAYOUT_ORDER = [
  "badges", "situacao", "atendimento", "caminho", "observacoes",
  "email", "responsavel", "criarTarefa", "proximaAcao", "ultimoHistorico",
];

// Linha compacta de um item de acompanhamento (próxima ação, último
// histórico, e-mail identificado) — a pedido do usuário: a versão antiga
// empilhava uma caixa grande, com borda e fundo coloridos, pra cada item, o
// que deixava a coluna lateral do processo enorme. Agora cada um é uma
// caixa independente e compacta, com uma barra de cor à esquerda (mesmo
// sinal de urgência, bem menos peso visual).
function PainelItem({ cor, titulo, acoes, children }) {
  return (
    <div style={{ borderLeft: `3px solid ${cor}`, paddingLeft: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: cor }}>{titulo}</div>
      {children}
      {acoes && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>{acoes}</div>}
    </div>
  );
}

// Compacto o bastante pra ficar lado a lado com Responsável (a pedido do
// usuário) — "Ver completo"/"Transformar"/"Dispensar" continuam valendo, só
// com rótulos mais curtos pra caber na largura menor.
function EmailAlertBox({ alertas, onVer, onUsar, onDispensar }) {
  const a = alertas[0];
  return (
    <div style={{ minWidth: 0, overflow: "hidden", height: "100%", borderRadius: 8, padding: "10px 12px", background: "rgba(var(--info-rgb),.08)", border: "1px solid rgba(var(--info-rgb),.3)" }}>
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
    <div className={"responsavel-box" + (!atual ? " needs-attention" : "")} style={{ minWidth: 0, overflow: "hidden", height: "100%", borderRadius: 8, padding: "10px 12px", ...(atual ? { background: "var(--surface-2)", border: "1px solid var(--border)" } : {}) }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: !atual ? "var(--warn)" : "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".5px" }}>
        {!atual ? "⚠ Responsável" : "Responsável"}
      </div>
      <select
        className="inline" style={{ width: "100%", marginTop: 6 }} value={atual ? atual.id : ""}
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

// Observações (CORP), agora editável (a pedido do usuário) — clique no
// texto ou no lápis abre uma textarea (preserva quebras de linha); salva
// como override de campo, igual ao resto dos campos editáveis (Visão
// geral), então convive numa boa com o valor original vindo da API.
function ObservacoesBox({ c, overrides, actions, canEdit }) {
  const [editing, setEditing] = useState(false);
  const valor = campoEfetivo(overrides, c, "observacoes") || "";
  const edited = campoFoiEditado(overrides, c, "observacoes");

  function openEditor() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    setEditing(true);
  }
  function commit(v) {
    actions.setOverrideCampo(c.id, "observacoes", v);
    actions.logAudit(c.id, "Observações (CORP) editadas", v && v.trim() ? "atualizado" : "(limpo)");
    setEditing(false);
  }

  return (
    <div style={{ minWidth: 0, height: "100%", boxSizing: "border-box", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Observações (CORP)</div>
        {edited && <span className="tag-manual">editado</span>}
        {!editing && <a title="Editar" style={{ opacity: 0.6, cursor: "pointer", marginLeft: "auto" }} onClick={openEditor}>✎</a>}
      </div>
      {editing ? (
        <textarea
          autoFocus rows={3}
          style={{ width: "100%", flex: 1, resize: "vertical", fontSize: 13, fontFamily: "inherit" }}
          defaultValue={valor}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        <div
          style={{ fontSize: 13, whiteSpace: "pre-wrap", color: valor ? "var(--ink-soft)" : "var(--muted)", cursor: canEdit ? "pointer" : "default", flex: 1, overflow: "auto" }}
          onClick={openEditor}
        >
          {valor || "Clique para adicionar uma observação..."}
        </div>
      )}
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
  // Índice do e-mail aberto no modal (não o objeto direto): quando o
  // processo tem mais de um e-mail vinculado, as setas ‹ › do
  // EmailViewerModal precisam saber a posição atual pra andar pra
  // frente/trás dentro de emailAlertas, e Usar/Dispensar (lá dentro)
  // precisam agir sobre o e-mail exibido no momento, não sempre o primeiro.
  const [emailModalIndex, setEmailModalIndex] = useState(null);
  const emailAberto = emailModalIndex != null ? emailAlertas[emailModalIndex] : null;
  const [editMode, setEditMode] = useState(false);

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

  // Anexo do e-mail exibido no modal (a pedido do usuário: precisa dar pra
  // baixar dali, não só na Caixa de entrada) — usa o mesmo token do Gmail
  // já salvo no navegador; se a sessão do Gmail expirou, só avisa, sem
  // travar a tela.
  async function baixarAnexoDoAlerta(alerta, anexo) {
    try {
      const token = getGmailToken();
      if (!token) throw new Error("Sessão do Gmail expirada. Abra E-mails e conecte de novo pra poder baixar anexos.");
      await baixarAnexoGmail(token, alerta.emailId, anexo);
    } catch (e) {
      alert(e.message || "Falha ao baixar o anexo.");
    }
  }

  // Layout do cabeçalho (ordem + tamanho de cada caixa) — compartilhado pra
  // todo mundo via config (Firebase), a pedido do usuário. IDs de um layout
  // salvo que não existem mais (ex.: caixa removida numa versão futura) são
  // ignorados; IDs novos que não estão no layout salvo entram no fim.
  const layoutCfg = config.corp_detail_layout || {};
  const savedOrder = layoutCfg.order || [];
  const layoutOrder = [
    ...savedOrder.filter((id) => DEFAULT_LAYOUT_ORDER.includes(id)),
    ...DEFAULT_LAYOUT_ORDER.filter((id) => savedOrder.indexOf(id) < 0),
  ];
  const layoutSizes = layoutCfg.sizes || {};

  function handleChangeOrder(newOrder) {
    saveConfig("corp_detail_layout", (cur) => ({ ...(cur || {}), order: newOrder }));
  }
  function handleChangeSize(id, size) {
    saveConfig("corp_detail_layout", (cur) => {
      const base = cur || {};
      return { ...base, sizes: { ...(base.sizes || {}), [id]: size } };
    });
  }

  const boxes = {
    badges: (
      <div className="detail-badges" style={{ alignItems: "center" }}>
        <PartyBadge pt={c.partyType} />
        {isManualClaim(c) && <span className="badge purple" title={"Criado por " + (c.criadoPor || "—")}>✎ Criado manualmente</span>}
        <span className={"badge " + situacaoEfe.cls}>{situacaoEfe.label}</span>
        {rel.length ? <span className="badge purple">{rel.length} processo(s) vinculado(s)</span> : <span className="badge gray">Sem vínculos</span>}
      </div>
    ),

    situacao: (
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
    ),

    atendimento: (
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
    ),

    caminho: caminho
      ? <span className={"badge " + (caminho === "integral" ? "red" : "blue")}>{caminho === "integral" ? "Perda Integral" : "Perda Parcial"}</span>
      : <span className="badge gray">Caminho não definido</span>,

    observacoes: <ObservacoesBox c={c} overrides={overrides} actions={actions} canEdit={canEdit} />,

    email: emailAlertas.length > 0 ? (
      <EmailAlertBox
        alertas={emailAlertas}
        onVer={() => setEmailModalIndex(0)}
        onUsar={() => usarEmailComoAtualizacao(emailAlertas[0])}
        onDispensar={() => actions.dismissEmailAlerta(c.id, emailAlertas[0].emailId)}
      />
    ) : null,

    responsavel: <ResponsavelBox c={c} users={users} overrides={overrides} actions={actions} canEdit={canEdit} />,

    criarTarefa: (
      <button
        className="btn sec xs" style={{ width: "100%", height: "100%" }}
        onClick={() => {
          setDemandaPrefill({ titulo: `Processo ${numsinEf || "#" + c.nosnum} — ${txt(seguradoEf)}`, descricao: "", processoId: c.id });
          navigate("tarefas", "newfromdemanda");
        }}
      >
        + Criar tarefa vinculada a este processo
      </button>
    ),

    proximaAcao: (
      <div style={{ minWidth: 0, height: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "10px 12px" }}>
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
      </div>
    ),

    ultimoHistorico: (
      <div style={{ minWidth: 0, height: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "10px 12px" }}>
        <PainelItem
          cor={semAtualizacao ? "var(--danger)" : "var(--ink-soft)"}
          titulo={semAtualizacao ? "⚠ Último histórico (+3 dias)" : "Último histórico"}
          acoes={<button className="btn sec xs" onClick={() => setDetailTab("historico")}>Abrir histórico</button>}
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
    ),
  };

  return (
    <div className="detail-head">
      <button className="btn sec sm" style={{ marginBottom: 12 }} onClick={() => navigate("sinistros")}>← Voltar aos sinistros</button>
      <h1>{(numsinEf ? "Sinistro " + numsinEf : "Registro #" + c.nosnum) + " — " + txt(seguradoEf)}</h1>
      <div className="sub">Placa {txt(placaEf)} • {txt(ciaEf)} • Ramo {txt(ramoEf)} • Apólice {txt(numapoEf)} • Oficina {txt(oficinaEf)}</div>

      {isAdminUser && (
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "10px 0 4px" }}>
          <button className={"btn xs " + (editMode ? "" : "sec")} onClick={() => setEditMode((v) => !v)}>
            {editMode ? "✓ Concluir reorganização" : "⚙ Reorganizar layout"}
          </button>
        </div>
      )}
      {editMode && (
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
          Arraste pela alça ⠿ pra mover uma caixa (linha de cima, de baixo, pro lado) e puxe as bordas/cantos pra redimensionar. O layout é salvo pra todo mundo que usa o sistema.
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <HeaderLayoutGrid
          boxes={boxes}
          editMode={editMode}
          order={layoutOrder}
          sizes={layoutSizes}
          onChangeOrder={handleChangeOrder}
          onChangeSize={handleChangeSize}
        />
      </div>

      <EmailViewerModal
        email={emailAberto}
        index={emailModalIndex}
        total={emailAlertas.length}
        onPrev={() => setEmailModalIndex((i) => Math.max(0, i - 1))}
        onNext={() => setEmailModalIndex((i) => Math.min(emailAlertas.length - 1, i + 1))}
        onClose={() => setEmailModalIndex(null)}
        onUsar={() => emailAberto && usarEmailComoAtualizacao(emailAberto)}
        onBaixarAnexo={(anexo) => emailAberto && baixarAnexoDoAlerta(emailAberto, anexo)}
        onDispensar={() => {
          if (!emailAberto) return;
          const restantes = emailAlertas.length - 1;
          actions.dismissEmailAlerta(c.id, emailAberto.emailId);
          setEmailModalIndex(restantes <= 0 ? null : Math.min(emailModalIndex, restantes - 1));
        }}
      />
    </div>
  );
}
