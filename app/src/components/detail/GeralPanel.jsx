import { useState } from "react";
import { KvList } from "../KvList.jsx";
import { EditableCell } from "../EditableCell.jsx";
import { OficinaModal } from "./OficinaModal.jsx";
import {
  distinctComputed, campoEfetivo, campoFoiEditado, situacaoEfetiva,
  getAgenteProdutor, getAgentesEfetivo, distinctProdutores,
} from "../../logic/claims";
import { txt } from "../../logic/format";
import { useDocumentoCorp } from "../../hooks/useDocumentoCorp";

// Formulário inline (editar linha existente OU adicionar uma nova) do par
// Agente/Produtor — texto livre (não só o catálogo), com sugestões via
// <datalist>, porque o objetivo aqui é justamente poder corrigir um valor
// que a API trouxe errado, não só escolher entre valores já conhecidos.
function ParForm({ agente: agenteInicial, produtor: produtorInicial, agenteOpts, produtorOpts, listId, onSave, onCancel }) {
  const [agente, setAgente] = useState(agenteInicial || "");
  const [produtor, setProdutor] = useState(produtorInicial || "");
  return (
    <div className="grid c2" style={{ marginTop: 8, marginBottom: 8 }}>
      <div className="field"><label>Agente</label>
        <input list={listId + "-ag"} value={agente} onChange={(e) => setAgente(e.target.value)} placeholder="Nome do agente" />
        <datalist id={listId + "-ag"}>{agenteOpts.map((a) => <option key={a} value={a} />)}</datalist>
      </div>
      <div className="field"><label>Produtor</label>
        <input list={listId + "-pr"} value={produtor} onChange={(e) => setProdutor(e.target.value)} placeholder="Nome do produtor" />
        <datalist id={listId + "-pr"}>{produtorOpts.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
        <button type="button" className="btn xs" onClick={() => onSave({ agente: agente.trim(), produtor: produtor.trim() })}>Salvar</button>
        <button type="button" className="btn ghost xs" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function ParRow({ par, index, agenteOpts, produtorOpts, listId, canEdit, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  function exigirEdicao(fn) {
    return () => {
      if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
      fn();
    };
  }
  if (editing) {
    return (
      <ParForm
        agente={par.agente} produtor={par.produtor} agenteOpts={agenteOpts} produtorOpts={produtorOpts} listId={listId}
        onSave={(v) => { onSave(index, v); setEditing(false); }} onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <div style={{ fontSize: 13 }}><b>{txt(par.produtor)}</b> <span className="muted">— agente: {txt(par.agente)}</span></div>
      {canEdit && (
        <span style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <a style={{ cursor: "pointer", opacity: 0.7 }} onClick={exigirEdicao(() => setEditing(true))}>✎ editar</a>
          <a style={{ cursor: "pointer", color: "var(--danger)" }} onClick={exigirEdicao(() => onRemove(index))}>✕ remover</a>
        </span>
      )}
    </div>
  );
}

// Agente/Produtor: normalmente vêm em pares (o mais comum são 2, mas pode
// vir 1 ou vários) de um endpoint separado do CORP (/documento) — busca sob
// demanda ao abrir a aba. A pedido do usuário, cada par pode ser editado,
// removido ou um novo adicionado, independente dos demais (editar um não
// mexe no outro), e a próxima busca ao CORP não desfaz a edição: assim que
// qualquer edição acontece aqui, `agenteProdutorManual` é marcado em
// overrides e useDocumentoCorp para de sobrescrever este processo (ver
// useOverrideActions.saveAgenteProdutorPares e useDocumentoCorp.js).
// Processos manuais (sem nosnum real) simplesmente não têm o que buscar —
// a lista aqui já nasce vazia e só cresce pelo "+ Adicionar" abaixo.
function AgenteProdutorBox({ c, config, overrides, claims, actions, canEdit }) {
  const { carregando, erro } = useDocumentoCorp(c, config, actions, overrides);
  const [addingNew, setAddingNew] = useState(false);
  const ap = getAgenteProdutor(overrides, c.id) || {};
  const pares = ap.prodDocs || [];
  const agenteOpts = getAgentesEfetivo(config, overrides, claims);
  const produtorOpts = distinctProdutores(overrides, claims);
  const listId = "ap_" + c.id;

  function persistir(novosPares) {
    actions.saveAgenteProdutorPares(c.id, novosPares);
    actions.logAudit(c.id, "Agente/Produtor editado", `${novosPares.length} vínculo(s) — editado manualmente`);
  }
  function salvarPar(index, novoPar) { persistir(pares.map((p, i) => (i === index ? novoPar : p))); }
  function removerPar(index) {
    if (!confirm("Remover este vínculo de agente/produtor?")) return;
    persistir(pares.filter((_, i) => i !== index));
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <label style={{ margin: 0 }}>Agente / Produtor</label>
        {carregando && <span className="muted" style={{ fontSize: 12 }}>Buscando...</span>}
      </div>
      {erro && !pares.length && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erro}</div>}
      {!pares.length && !carregando && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Nenhum agente/produtor vinculado.</div>
      )}
      {pares.map((p, i) => (
        <ParRow key={i} par={p} index={i} agenteOpts={agenteOpts} produtorOpts={produtorOpts} listId={listId + "-" + i} canEdit={canEdit} onSave={salvarPar} onRemove={removerPar} />
      ))}
      {addingNew ? (
        <ParForm
          agenteOpts={agenteOpts} produtorOpts={produtorOpts} listId={listId + "-new"}
          onSave={(v) => { persistir([...pares, v]); setAddingNew(false); }} onCancel={() => setAddingNew(false)}
        />
      ) : canEdit && (
        <button type="button" className="btn ghost xs" style={{ marginTop: 6 }} onClick={() => setAddingNew(true)}>+ Adicionar agente/produtor</button>
      )}
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
    ["Nome", cell("segurado", { className: "nome-cliente" })],
    ["Placa", cell("placa")],
    ["Marca", cell("veiculoMarca")],
    ["Modelo", cell("veiculoModelo")],
    ["Ano Modelo", cell("veiculoAno")],
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
      <AgenteProdutorBox c={c} config={config} overrides={overrides} claims={claims} actions={actions} canEdit={canEdit} />
    </div>
  );
}
