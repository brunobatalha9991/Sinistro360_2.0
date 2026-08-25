import { useState } from "react";
import { KvList } from "../KvList.jsx";
import { EditableCell } from "../EditableCell.jsx";
import { OficinaModal } from "./OficinaModal.jsx";
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

// Porte 1:1 de geralPanel() do HTML original — a pedido do usuário, de
// volta pro layout em lista única (a versão em seções/grade não agradou).
export function GeralPanel({ c, claims, overrides, actions, canEdit, config, navigate }) {
  const segOpts = distinctComputed(claims, (x) => campoEfetivo(overrides, x, "cia"));
  const ofOpts = distinctComputed(claims, (x) => campoEfetivo(overrides, x, "oficina"));
  function cell(campo, opts) {
    return (
      <EditableCell
        c={c} campo={campo} overrides={overrides} canEdit={canEdit}
        onCommit={(v) => actions.setOverrideCampo(c.id, campo, v)}
        {...(opts || {})}
      />
    );
  }
  const rows = [
    ["Tipo de parte", <span>{c.partyType}</span>],
    ["Nº do sinistro", cell("numsin")],
    ["Tipo (API)", <span>{txt(c.tipo)}</span>],
    ["Nome", cell("segurado")],
    ["Placa", cell("placa")],
    ["Seguradora", cell("cia", { type: "select", options: segOpts, emptyLabel: "Nenhuma", novoLabel: "+ Nova seguradora...", promptMsg: "Nome da nova seguradora:" })],
    ["Ramo", cell("ramo")],
    ["Apólice", cell("numapo")],
    ["Endosso", cell("numend")],
    ["Item", cell("item")],
    ["Filial", cell("codfil")],
    ["Nº controle", <span>{txt(c.nosnum)}</span>],
    ["Código", cell("codigo")],
    ["Situação", <span>{situacaoEfetiva(overrides, c, config.corp_atendimento_template).label}</span>],
    ["Oficina", <OficinaCell c={c} overrides={overrides} ofOpts={ofOpts} actions={actions} canEdit={canEdit} navigate={navigate} />],
    ["Vínculo com oficina", cell("vinculoOficina", { type: "select", options: ["Referenciada", "Livre Escolha"], emptyLabel: "Não definido" })],
    ["Dt. Ocorrência", cell("datoco", { type: "date" })],
    ["Dt. Aviso", cell("datavi", { type: "date" })],
    ["Encerramento", cell("datenc", { type: "date" })],
    ["Observações", cell("observacoes")],
  ];
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Informações gerais</h3>
        <span className="tag-manual">Clique num campo para editar • edições preservadas na sincronização</span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        O valor que você digitar prevalece sobre o dado da API e não se perde ao sincronizar. Nº controle e Tipo (API) não são editáveis. O dado bruto original continua visível na aba "Dados brutos (API)".
      </p>
      <KvList rows={rows} />
      <AgenteProdutorBox c={c} config={config} actions={actions} />
    </div>
  );
}
