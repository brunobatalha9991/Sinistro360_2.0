import { useState } from "react";
import { createPortal } from "react-dom";
import { EditableCell } from "../EditableCell.jsx";
import { OficinaModal } from "./OficinaModal.jsx";
import { FinancePanel } from "./FinancePanel.jsx";
import { AtendimentoPanel } from "./AtendimentoPanel.jsx";
import { distinctComputed, campoEfetivo, campoFoiEditado, situacaoEfetiva, isManualClaim } from "../../logic/claims";
import { txt } from "../../logic/format";
import { extractProdDocs } from "../../logic/corpApi";
import { useDocumentoCorp } from "../../hooks/useDocumentoCorp";

// Agente/Produtor vêm de um endpoint separado do CORP (/documento, não faz
// parte da sincronização normal de sinistros) — busca sob demanda ao abrir
// a aba, usando o "nosnum" do processo (chave universal no CORP) + codfil.
// Processos criados manualmente (sem nosnum real da API) não têm o que
// buscar aqui.
function AgenteProdutorBox({ c, config, actions }) {
  const { resp, carregando, erro } = useDocumentoCorp(c, config, actions);
  const prodDocs = extractProdDocs(resp);

  if (isManualClaim(c)) return null;

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <label style={{ margin: 0 }}>Agente / Produtor</label>
        {carregando && <span className="muted" style={{ fontSize: 12 }}>Buscando...</span>}
      </div>
      {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erro}</div>}
      {!carregando && !erro && !prodDocs.length && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nenhum agente/produtor encontrado para este processo.</div>
      )}
      {prodDocs.map((p, idx) => (
        <div key={idx} style={{ fontSize: 13, marginTop: 6 }}>
          <b>{txt(p.produtor)}</b> <span className="muted">— agente: {txt(p.agente)}</span>
        </div>
      ))}
    </div>
  );
}

// Campo "Oficina" — em vez do select simples de nome (só texto livre),
// abre o cadastro completo da oficina (módulo Oficinas: CNPJ, endereço,
// contatos, seguradoras referenciadas) direto do processo, a pedido do
// usuário. Mesmo visual clicável de EditableCell, mas abre um diálogo em
// vez de editar inline.
function OficinaCell({ c, overrides, ofOpts, actions, canEdit, navigate }) {
  const [open, setOpen] = useState(false);
  const valAtual = campoEfetivo(overrides, c, "oficina");
  const edited = campoFoiEditado(overrides, c, "oficina");

  function abrir() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    setOpen(true);
  }

  return (
    <>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {edited && <span className="tag-manual">editado</span>}
        <span style={{ cursor: "pointer" }} onClick={abrir}>
          {valAtual == null || String(valAtual).trim() === "" ? "—" : String(valAtual)}
        </span>
        <a title="Incluir/editar oficina" style={{ opacity: 0.6, cursor: "pointer" }} onClick={abrir}>✎</a>
      </span>
      {open && (
        <OficinaModal c={c} overrides={overrides} ofOpts={ofOpts} actions={actions} canEdit={canEdit} navigate={navigate} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// Cabeçalho de seção (mesmo estilo já usado no formulário de Solicitação de
// atendimento — SolicitacaoFields em TaskModal.jsx) — a pedido do usuário,
// pra organizar a Visão geral em blocos em vez de uma lista única.
function Secao({ titulo, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>{titulo}</div>
      {children}
    </div>
  );
}

// Financeiro e Atendimento deixaram de ser abas próprias (a pedido do
// usuário) e passam a abrir num diálogo a partir de um botão aqui — mesmo
// componente/lógica de antes, só a apresentação muda.
function PanelModal({ onClose, children }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div style={{ width: 640, maxWidth: "100%", position: "relative" }}>
        <button className="btn sec xs" style={{ position: "absolute", top: -14, right: -8 }} onClick={onClose}>✕ Fechar</button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Porte 1:1 de geralPanel() do HTML original, reorganizado em seções (a
// pedido do usuário: a lista única estava ficando extensa demais).
export function GeralPanel({ c, claims, overrides, actions, canEdit, config, navigate }) {
  const segOpts = distinctComputed(claims, (x) => campoEfetivo(overrides, x, "cia"));
  const ofOpts = distinctComputed(claims, (x) => campoEfetivo(overrides, x, "oficina"));
  const [financeiroAberto, setFinanceiroAberto] = useState(false);
  const [atendimentoAberto, setAtendimentoAberto] = useState(false);

  function cell(campo, opts) {
    return (
      <EditableCell
        c={c} campo={campo} overrides={overrides} canEdit={canEdit}
        onCommit={(v) => actions.setOverrideCampo(c.id, campo, v)}
        {...(opts || {})}
      />
    );
  }
  function field(label, node) {
    return <div className="field" key={label}><label>{label}</label>{node}</div>;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Informações gerais</h3>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
            Clique num campo para editar • O valor digitado prevalece sobre o dado da API e não se perde ao sincronizar.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn sec sm" onClick={() => setFinanceiroAberto(true)}>💰 Financeiro</button>
          <button className="btn sec sm" onClick={() => setAtendimentoAberto(true)}>📞 Atendimento</button>
        </div>
      </div>

      <Secao titulo="Identificação">
        <div className="grid c3">
          {field("Tipo de parte", <span>{c.partyType}</span>)}
          {field("Nº do sinistro", cell("numsin"))}
          {field("Situação", <span>{situacaoEfetiva(overrides, c, config.corp_atendimento_template).label}</span>)}
          {field("Nome", cell("segurado"))}
          {field("Placa", cell("placa"))}
          {field("Tipo (API)", <span>{txt(c.tipo)}</span>)}
        </div>
      </Secao>

      <Secao titulo="Seguro">
        <div className="grid c3">
          {field("Seguradora", cell("cia", { type: "select", options: segOpts, emptyLabel: "Nenhuma", novoLabel: "+ Nova seguradora...", promptMsg: "Nome da nova seguradora:" }))}
          {field("Ramo", cell("ramo"))}
          {field("Apólice", cell("numapo"))}
          {field("Endosso", cell("numend"))}
          {field("Item", cell("item"))}
          {field("Filial", cell("codfil"))}
          {field("Código", cell("codigo"))}
          {field("Nº controle", <span>{txt(c.nosnum)}</span>)}
        </div>
      </Secao>

      <Secao titulo="Oficina">
        <div className="grid c2">
          {field("Oficina", <OficinaCell c={c} overrides={overrides} ofOpts={ofOpts} actions={actions} canEdit={canEdit} navigate={navigate} />)}
          {field("Vínculo com oficina", cell("vinculoOficina", { type: "select", options: ["Referenciada", "Livre Escolha"], emptyLabel: "Não definido" }))}
        </div>
      </Secao>

      <Secao titulo="Datas">
        <div className="grid c3">
          {field("Dt. Ocorrência", cell("datoco", { type: "date" }))}
          {field("Dt. Aviso", cell("datavi", { type: "date" }))}
          {field("Encerramento", cell("datenc", { type: "date" }))}
        </div>
      </Secao>

      <Secao titulo="Observações">
        {cell("observacoes")}
      </Secao>

      <AgenteProdutorBox c={c} config={config} actions={actions} />

      {financeiroAberto && (
        <PanelModal onClose={() => setFinanceiroAberto(false)}>
          <FinancePanel c={c} overrides={overrides} actions={actions} canEdit={canEdit} />
        </PanelModal>
      )}
      {atendimentoAberto && (
        <PanelModal onClose={() => setAtendimentoAberto(false)}>
          <AtendimentoPanel c={c} claims={claims} overrides={overrides} actions={actions} canEdit={canEdit} />
        </PanelModal>
      )}
    </div>
  );
}
