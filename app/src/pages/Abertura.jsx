import { useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { useOverrideActions } from "../hooks/useOverrideActions";
import { useClienteActions } from "../hooks/useClienteActions";
import { EmptyState } from "../components/EmptyState.jsx";
import { ConsultaCorpBox } from "../components/ConsultaCorpBox.jsx";
import { ProcSearch } from "../components/ProcSearch.jsx";
import { canEdit as canEditRole } from "../data/auth";
import {
  distinctComputed, partyTypeFromTipo, defaultRamoTemplate, visibleClaims,
  campoEfetivo, getAgenteProdutor, getAgentesEfetivo, distinctProdutores,
} from "../logic/claims";
import { listaClientes, clienteIdFromNome } from "../logic/clientes";
import { todayISO, isoFromBR } from "../logic/format";
import { takePendingTaskLink } from "../state/taskModal";
import { takeAberturaPrefill } from "../state/aberturaPrefill";

const NEW_SENTINEL = "__novo__";

function contatoVazio() { return { nome: "", telefone: "", cargo: "" }; }

// Mesmos campos do cadastro completo (CadastroPanel.jsx, módulo Clientes),
// numa caixa compacta — a pedido do usuário, pra poder consultar um cliente
// já cadastrado ou já deixar os dados dele registrados na hora de abrir o
// processo, sem precisar ir no módulo Clientes depois. `clienteId` é
// derivado só do nome (clienteIdFromNome) — funciona mesmo antes de existir
// qualquer processo com esse nome.
function ClienteCadastroBox({ clienteId, cadastro, actions, canEdit, onClose }) {
  const [documento, setDocumento] = useState(cadastro.documento || "");
  const [endereco, setEndereco] = useState(cadastro.endereco || "");
  const [observacoes, setObservacoes] = useState(cadastro.observacoes || "");
  const [contatos, setContatos] = useState(cadastro.contatos && cadastro.contatos.length ? cadastro.contatos : [contatoVazio()]);

  function salvar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar dados de cliente."); return; }
    actions.saveCadastro(clienteId, {
      documento: documento.trim(), endereco: endereco.trim(), observacoes: observacoes.trim(),
      contatos: contatos.filter((c) => c.nome.trim() || c.telefone.trim()),
    });
    alert("Dados do cliente salvos.");
  }

  return (
    <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>Dados do cliente</b>
        <button type="button" className="btn ghost xs" onClick={onClose}>✕ Fechar</button>
      </div>
      <div className="grid c2">
        <div className="field"><label>CPF / CNPJ</label><input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="000.000.000-00 ou 00.000.000/0000-00" /></div>
        <div className="field"><label>Endereço</label><input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade/UF" /></div>
      </div>
      <div className="field"><label>Observações</label><textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
      <div style={{ marginTop: 8 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Contatos</label>
        {contatos.map((ct, i) => (
          <div key={i} className="grid c3" style={{ marginBottom: 6 }}>
            <input placeholder="Nome" value={ct.nome} onChange={(e) => setContatos((cur) => cur.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
            <input placeholder="Telefone" value={ct.telefone} onChange={(e) => setContatos((cur) => cur.map((x, j) => (j === i ? { ...x, telefone: e.target.value } : x)))} />
            <input placeholder="Cargo" value={ct.cargo} onChange={(e) => setContatos((cur) => cur.map((x, j) => (j === i ? { ...x, cargo: e.target.value } : x)))} />
          </div>
        ))}
        <button type="button" className="btn sec xs" onClick={() => setContatos((cur) => [...cur, contatoVazio()])}>+ Adicionar contato</button>
      </div>
      <button type="button" className="btn xs" style={{ marginTop: 10 }} onClick={salvar}>Salvar dados do cliente</button>
    </div>
  );
}

// Campo "Nome (segurado/terceiro)" com busca de clientes já cadastrados
// (autocompletar pelo nome, entre os que já têm processo) e atalho pra
// consultar/cadastrar os dados de contato dele (mesmo cadastro do módulo
// Clientes — ver ClienteCadastroBox acima) — a pedido do usuário.
function ClienteNomeField({ nome, setNome, claims, overrides, clienteActions, canEdit, config, onUsarCorp, navigate }) {
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [consultaCorpAberta, setConsultaCorpAberta] = useState(false);

  const clientesLista = listaClientes(claims, overrides, clienteActions.clientes);
  const termo = nome.trim().toLowerCase();
  const sugestoes = termo.length >= 2 ? clientesLista.filter((cl) => cl.nome.toLowerCase().indexOf(termo) >= 0).slice(0, 8) : [];
  const clienteId = nome.trim() ? clienteIdFromNome(nome.trim()) : null;
  const cadastroExistente = clienteId ? (clienteActions.clientes[clienteId] || null) : null;

  return (
    <div className="field" style={{ position: "relative" }}>
      <label>Nome (segurado/terceiro)</label>
      <input
        placeholder="Digite pra buscar um cliente já cadastrado, ou o nome de um novo"
        value={nome}
        onChange={(e) => { setNome(e.target.value); setMostrarSugestoes(true); }}
        onFocus={() => setMostrarSugestoes(true)}
        onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
      />
      {mostrarSugestoes && sugestoes.length > 0 && (
        <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 8, marginTop: 2, maxHeight: 200, overflow: "auto", boxShadow: "var(--shadow-lg)" }}>
          {sugestoes.map((cl) => (
            <div
              key={cl.id} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-soft)" }}
              onMouseDown={() => { setNome(cl.nome); setMostrarSugestoes(false); }}
            >{cl.nome}</div>
          ))}
        </div>
      )}
      {nome.trim() && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <button type="button" className="btn ghost xs" onClick={() => setCadastroAberto((v) => !v)}>
            {cadastroExistente ? "📇 Ver/editar dados do cliente" : "+ Cadastrar dados deste cliente"}
          </button>
          <button type="button" className="btn ghost xs" onClick={() => setConsultaCorpAberta((v) => !v)}>🔍 Consultar no CORP</button>
        </div>
      )}
      {cadastroAberto && clienteId && (
        <ClienteCadastroBox clienteId={clienteId} cadastro={cadastroExistente || {}} actions={clienteActions} canEdit={canEdit} onClose={() => setCadastroAberto(false)} />
      )}
      {consultaCorpAberta && (
        <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <b style={{ fontSize: 13 }}>Consultar no CORP</b>
            <button type="button" className="btn ghost xs" onClick={() => setConsultaCorpAberta(false)}>✕ Fechar</button>
          </div>
          <ConsultaCorpBox
            config={config} termoInicial={nome}
            onUsar={(r) => { onUsarCorp(r); setConsultaCorpAberta(false); }}
            clienteActions={clienteActions} navigate={navigate}
          />
        </div>
      )}
    </div>
  );
}

// Porte 1:1 de createManualClaim() do HTML original.
function buildManualClaim(data, currentUser) {
  const tipoRaw = data.tipoParte === "Terceiro" ? "TERCEIRO" : data.tipoParte === "Atendimento" ? "ATENDIMENTO" : "SINISTRO";
  return {
    id: "man_" + Math.random().toString(36).slice(2, 9),
    codfil: "", nosnum: "MAN-" + Date.now(), numsin: (data.numsin || "").trim(), tipo: tipoRaw, codigo: "",
    partyType: partyTypeFromTipo(tipoRaw),
    linkKey: "",
    segurado: (data.segurado || "").trim(), cia: (data.cia || "").trim(), ramo: (data.ramo || "").trim(),
    numapo: (data.numapo || "").trim(), numend: (data.numend || "").trim(), item: (data.item || "").trim(),
    placa: (data.placa || "").trim().toUpperCase(), situacao: "PENDENTE",
    veiculoMarca: (data.veiculoMarca || "").trim(), veiculoModelo: (data.veiculoModelo || "").trim(), veiculoAno: (data.veiculoAno || "").trim(),
    franquia: Number(data.franquia) || 0, valavi: Number(data.valavi) || 0, valind: 0, valdes: 0,
    datavi: data.datavi || todayISO(), datoco: data.datoco || "", datenc: "", datvis: "", datlib: "",
    responsavel: "", oficina: (data.oficina || "").trim(), tipo_atendimento: "",
    descricao: (data.descricao || "").trim(), observacoes: (data.observacoes || "").trim(),
    origem: "manual",
    criadoPor: (currentUser && currentUser.nome) || "—",
    criadoEm: new Date().toISOString(),
    sync_corp: { status: "local_only", sentAt: null, corpRef: null },
    _raw: null,
  };
}

export function Abertura() {
  const { records, config, saveRecord, saveConfig } = useData();
  const { navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const actions = useOverrideActions();
  const clienteActions = useClienteActions();

  const overrides = records.corp_overrides || {};
  const claims = visibleClaims(records.corp_claims, overrides, currentUser);
  const users = records.corp_users || [];
  const templates = config.corp_journey_templates || {};

  const ciaOpts = distinctComputed(claims, (c) => c.cia);
  const ramoOpts = Object.keys(templates).sort();
  const oficinaOpts = distinctComputed(claims, (c) => c.oficina);
  const agenteOpts = getAgentesEfetivo(config, overrides, claims);
  const produtorOpts = distinctProdutores(overrides, claims);

  // Capturado uma única vez ao montar: preenchimento vindo do módulo
  // Clientes ("+ Abrir novo atendimento para este cliente") ou do atalho
  // "+ Abrir processo vinculado" dentro de um processo já aberto (ver
  // DetailHeader.jsx), se houver.
  const [aberturaPrefillValue] = useState(() => takeAberturaPrefill());

  // A partir de um processo "vinculado" (escolhido no campo de busca abaixo,
  // ou vindo do atalho de dentro do processo) — Seguradora/Ramo/Apólice/Data
  // de ocorrência/Agente/Produtor são do mesmo evento, então valem também
  // para o novo processo. Mapeia pro <select> igual a preencherDaConsultaCorp
  // (NEW_SENTINEL quando o valor ainda não está no catálogo local).
  function computeVinculoFields(target) {
    if (!target) return null;
    const tcia = campoEfetivo(overrides, target, "cia") || "";
    const tramo = campoEfetivo(overrides, target, "ramo") || "";
    const tnumapo = campoEfetivo(overrides, target, "numapo") || "";
    const tdatoco = campoEfetivo(overrides, target, "datoco") || "";
    const ap = getAgenteProdutor(overrides, target.id) || {};
    return {
      ciaIsNew: !!(tcia && ciaOpts.indexOf(tcia) < 0), cia: tcia,
      ramoIsNew: !!(tramo && ramoOpts.indexOf(tramo) < 0), ramo: tramo,
      numapo: tnumapo, datoco: tdatoco,
      agente: (ap.agentes || [])[0] || "", produtor: (ap.produtores || [])[0] || "",
    };
  }

  const vinculoTarget = aberturaPrefillValue?.vinculoProcessoId
    ? claims.find((x) => x.id === aberturaPrefillValue.vinculoProcessoId) || null
    : null;
  const vinculoInit = computeVinculoFields(vinculoTarget);

  const [tipoParte, setTipoParte] = useState(aberturaPrefillValue?.tipoParte || "Segurado");
  const [segurado, setSegurado] = useState(aberturaPrefillValue?.segurado || "");
  const [placa, setPlaca] = useState("");
  const [veiculoMarca, setVeiculoMarca] = useState("");
  const [veiculoModelo, setVeiculoModelo] = useState("");
  const [veiculoAno, setVeiculoAno] = useState("");
  const [numsin, setNumsin] = useState("");
  const [cia, setCia] = useState(vinculoInit ? (vinculoInit.ciaIsNew ? NEW_SENTINEL : vinculoInit.cia) : "");
  const [ciaNova, setCiaNova] = useState(vinculoInit && vinculoInit.ciaIsNew ? vinculoInit.cia : "");
  const [ramo, setRamo] = useState(vinculoInit ? (vinculoInit.ramoIsNew ? NEW_SENTINEL : vinculoInit.ramo) : "");
  const [ramoNovo, setRamoNovo] = useState(vinculoInit && vinculoInit.ramoIsNew ? vinculoInit.ramo : "");
  const [oficina, setOficina] = useState("");
  const [oficinaNova, setOficinaNova] = useState("");
  const [numapo, setNumapo] = useState(vinculoInit?.numapo || "");
  const [numend, setNumend] = useState("");
  const [item, setItem] = useState("");
  const [datoco, setDatoco] = useState(vinculoInit?.datoco || "");
  const [datavi, setDatavi] = useState(todayISO());
  const [franquia, setFranquia] = useState("");
  const [valavi, setValavi] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState(null);
  // Agente/Produtor (obrigatórios para Segurado/Terceiro — a pedido do
  // usuário). agente aceita "+ Novo agente..." (mesmo padrão de
  // seguradora/ramo/oficina); produtor só vem do catálogo já existente
  // (mesma regra de AgentesCatalogoCard.jsx: "produtor não tem cadastro
  // manual").
  const [agenteSel, setAgenteSel] = useState(vinculoInit?.agente || "");
  const [agenteNovo, setAgenteNovo] = useState("");
  const [produtorSel, setProdutorSel] = useState(vinculoInit?.produtor || "");
  // Vínculo com outro processo do mesmo evento (Segurado ↔ Terceiro) — ao
  // escolher, reaplica computeVinculoFields (mesmo efeito do prefill acima).
  const [vinculoId, setVinculoId] = useState(vinculoTarget ? vinculoTarget.id : "");
  // Capturado uma única vez ao montar: id da tarefa que disparou o atalho
  // "abrir novo atendimento" (Mesa de Atendimento), se houver — o processo
  // criado aqui é vinculado automaticamente a ela.
  const [tarefaVinculada] = useState(() => takePendingTaskLink());

  function aplicarVinculo(claimId) {
    setVinculoId(claimId);
    if (!claimId) return;
    const target = claims.find((x) => x.id === claimId);
    const f = computeVinculoFields(target);
    if (!f) return;
    if (f.cia) { setCia(f.ciaIsNew ? NEW_SENTINEL : f.cia); setCiaNova(f.ciaIsNew ? f.cia : ""); }
    if (f.ramo) { setRamo(f.ramoIsNew ? NEW_SENTINEL : f.ramo); setRamoNovo(f.ramoIsNew ? f.ramo : ""); }
    if (f.numapo) setNumapo(f.numapo);
    if (f.datoco) setDatoco(f.datoco);
    if (f.agente) { setAgenteSel(f.agente); setAgenteNovo(""); }
    if (f.produtor) setProdutorSel(f.produtor);
  }

  function vinculoLabel() {
    if (tipoParte === "Segurado") return "Vincular ao processo do Terceiro (mesmo evento)";
    if (tipoParte === "Terceiro") return "Vincular ao processo do Segurado (mesmo evento)";
    return "Vincular a outro processo (opcional)";
  }

  const canEdit = canEditRole(currentUser);
  if (!canEdit) {
    return (
      <div className="page-enter">
        <div className="page-head"><div><h1>Abertura</h1><p>Criação manual de processos</p></div></div>
        <div className="card"><EmptyState>Seu perfil é apenas de consulta. Você não pode abrir novos processos.</EmptyState></div>
      </div>
    );
  }

  // Preenche o formulário a partir de um resultado da consulta ao vivo no
  // CORP (ver ConsultaCorpBox) — a pedido do usuário, pra não precisar
  // digitar de novo o que o CORP já tem. Seguradora/ramo/oficina que ainda
  // não estejam no catálogo local caem no fluxo de "+ Novo/Nova..." já
  // existente (NEW_SENTINEL), em vez de um valor que o <select> não teria
  // como exibir.
  function preencherDaConsultaCorp(r) {
    setSegurado(r.segurado || "");
    setPlaca(r.placa || "");
    setNumsin(r.numsin || "");
    if (r.cia) {
      if (ciaOpts.indexOf(r.cia) >= 0) { setCia(r.cia); setCiaNova(""); }
      else { setCia(NEW_SENTINEL); setCiaNova(r.cia); }
    }
    if (r.ramo) {
      if (ramoOpts.indexOf(r.ramo) >= 0) { setRamo(r.ramo); setRamoNovo(""); }
      else { setRamo(NEW_SENTINEL); setRamoNovo(r.ramo); }
    }
    if (r.oficina) {
      if (oficinaOpts.indexOf(r.oficina) >= 0) { setOficina(r.oficina); setOficinaNova(""); }
      else { setOficina(NEW_SENTINEL); setOficinaNova(r.oficina); }
    }
    setNumapo(r.numapo || "");
    setNumend(r.numend || "");
    setItem(r.item != null ? String(r.item) : "");
    const datocoIso = isoFromBR(r.datoco);
    if (datocoIso) setDatoco(datocoIso);
    const dataviIso = isoFromBR(r.datavi);
    if (dataviIso) setDatavi(dataviIso);
    if (r.franquia) setFranquia(String(r.franquia));
    if (r.valavi) setValavi(String(r.valavi));
    if (r.observacoes) setObservacoes(r.observacoes);
    if (r.descricao) setDescricao(r.descricao);
  }

  // Agente/Produtor/Responsável são obrigatórios para Segurado/Terceiro (a
  // pedido do usuário) — Atendimento (sem apólice) fica de fora.
  const exigeVinculos = tipoParte !== "Atendimento";
  const agenteFinal = agenteSel === NEW_SENTINEL ? agenteNovo.trim() : agenteSel;

  function criar() {
    const nome = segurado.trim();
    if (!nome) { setStatus({ cls: "err", msg: "Informe o nome do segurado/terceiro." }); return; }
    if (exigeVinculos && (!agenteFinal || !produtorSel || !responsavelId)) {
      setStatus({ cls: "err", msg: "Para Segurado/Terceiro, Agente, Produtor e Responsável são obrigatórios." });
      return;
    }
    const ciaFinal = cia === NEW_SENTINEL ? ciaNova.trim() : cia;
    const ramoFinal = ramo === NEW_SENTINEL ? ramoNovo.trim().toUpperCase() : ramo;
    const oficinaFinal = oficina === NEW_SENTINEL ? oficinaNova.trim() : oficina;

    const claim = buildManualClaim({
      tipoParte, segurado: nome, placa, numsin, cia: ciaFinal, ramo: ramoFinal, oficina: oficinaFinal,
      numapo, numend, item, datoco, datavi, franquia, valavi, observacoes, descricao,
      veiculoMarca, veiculoModelo, veiculoAno,
    }, currentUser);

    if (claim.ramo) {
      saveConfig("corp_journey_templates", (current) => {
        const t = current || {};
        if (t[claim.ramo]) return t;
        return { ...t, [claim.ramo]: defaultRamoTemplate() };
      });
    }
    saveRecord("corp_claims", (current) => [...(current || []), claim]);
    if (responsavelId) {
      const u = users.find((x) => x.id === responsavelId);
      if (u) actions.saveResponsavel(claim.id, u, { motivo: "Responsável inicial definido na abertura manual do processo" });
    }
    if (agenteFinal || produtorSel) {
      actions.saveAgenteProdutorPares(claim.id, [{ agente: agenteFinal, produtor: produtorSel }]);
    }
    if (agenteSel === NEW_SENTINEL && agenteNovo.trim() && agenteOpts.indexOf(agenteNovo.trim()) < 0) {
      saveConfig("corp_agentes_catalogo", (cur) => [...(cur || []), agenteNovo.trim()]);
    }
    if (vinculoId) {
      actions.addLink(claim.id, vinculoId);
      const alvo = claims.find((x) => x.id === vinculoId);
      actions.logAudit(claim.id, "Vinculado automaticamente", alvo ? `Vinculado ao processo ${alvo.numsin || "#" + alvo.nosnum} — ${alvo.segurado}` : "");
    }
    actions.logAudit(claim.id, "Processo criado manualmente", "Via módulo Abertura");

    if (tarefaVinculada) {
      const agora = new Date().toISOString();
      saveRecord("corp_tasks", (current) => (current || []).map((t) => (
        t.id === tarefaVinculada
          ? { ...t, processo: claim.id, updatedAt: agora, log: [...(t.log || []), { at: agora, who: currentUser.id, acao: `Vinculada automaticamente ao processo ${claim.numsin || "#" + claim.nosnum} (criado via atalho de abertura)` }] }
          : t
      )));
    }

    setStatus({ cls: "ok", msg: "✔ Processo criado" + (tarefaVinculada ? " e vinculado à tarefa de origem" : "") + "! Abrindo..." });
    setTimeout(() => navigate("sinistro", claim.id), 400);
  }

  return (
    <div className="page-enter">
      <div className="page-head">
        <div><h1>Abertura</h1><p>Cria novos processos direto no sistema — Segurado, Terceiro ou Atendimento</p></div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Novo processo</h3>
        <p className="muted">
          Cria um processo direto no sistema (não vem da API CORP). Ele aparece em Sinistros, Clientes, Seguradoras, Oficinas, Dashboard e nos filtros normalmente, com identificação de "criado manualmente", e é preservado nas próximas sincronizações com a API.
        </p>

        {tarefaVinculada && (
          <div className="status ok" style={{ marginBottom: 12 }}>
            Este processo será vinculado automaticamente à tarefa de Mesa de Atendimento de onde você veio.
          </div>
        )}

        <div className="grid c3">
          <div className="field"><label>Tipo</label>
            <select value={tipoParte} onChange={(e) => setTipoParte(e.target.value)}>
              <option value="Segurado">Segurado</option>
              <option value="Terceiro">Terceiro</option>
              <option value="Atendimento">Atendimento</option>
            </select>
          </div>
          <ClienteNomeField
            nome={segurado} setNome={setSegurado} claims={claims} overrides={overrides} clienteActions={clienteActions}
            canEdit={canEdit} config={config} onUsarCorp={preencherDaConsultaCorp} navigate={navigate}
          />
          <div className="field"><label>Placa</label><input placeholder="ABC1D23" value={placa} onChange={(e) => setPlaca(e.target.value)} /></div>
        </div>

        <div className="grid c3">
          <div className="field"><label>Marca</label><input placeholder="Ex.: Fiat" value={veiculoMarca} onChange={(e) => setVeiculoMarca(e.target.value)} /></div>
          <div className="field"><label>Modelo</label><input placeholder="Ex.: Argo" value={veiculoModelo} onChange={(e) => setVeiculoModelo(e.target.value)} /></div>
          <div className="field"><label>Ano Modelo</label><input placeholder="Ex.: 2023" value={veiculoAno} onChange={(e) => setVeiculoAno(e.target.value)} /></div>
        </div>

        <div className="field">
          <label>{vinculoLabel()}</label>
          <ProcSearch
            value={{ label: vinculoTarget && vinculoId === vinculoTarget.id ? (vinculoTarget.numsin || "#" + vinculoTarget.nosnum) + " — " + vinculoTarget.segurado : "" }}
            onChange={aplicarVinculo} claims={claims}
          />
          {vinculoId && <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Seguradora, ramo, apólice, data de ocorrência, agente e produtor foram copiados desse processo. O vínculo é criado nos dois sentidos ao salvar.</p>}
        </div>

        <div className="grid c3">
          <div className="field"><label>Seguradora</label>
            <select value={cia} onChange={(e) => setCia(e.target.value)}>
              <option value="">— Selecione —</option>
              {ciaOpts.map((v) => <option key={v} value={v}>{v}</option>)}
              <option value={NEW_SENTINEL}>+ Nova seguradora...</option>
            </select>
          </div>
          <div className="field"><label>Nova seguradora</label>
            <input className={cia === NEW_SENTINEL ? "" : "hidden"} placeholder="Nome da nova seguradora" value={ciaNova} onChange={(e) => setCiaNova(e.target.value)} />
          </div>
          <div className="field"><label>Nº de sinistro (opcional)</label><input placeholder="Opcional — nº de referência, se já houver" value={numsin} onChange={(e) => setNumsin(e.target.value)} /></div>
        </div>

        <div className="grid c3">
          <div className="field"><label>Ramo</label>
            <select value={ramo} onChange={(e) => setRamo(e.target.value)}>
              <option value="">— Selecione —</option>
              {ramoOpts.map((v) => <option key={v} value={v}>{v}</option>)}
              <option value={NEW_SENTINEL}>+ Novo ramo...</option>
            </select>
          </div>
          <div className="field"><label>Novo ramo</label>
            <input className={ramo === NEW_SENTINEL ? "" : "hidden"} placeholder="Nome do novo ramo" value={ramoNovo} onChange={(e) => setRamoNovo(e.target.value)} />
          </div>
          <div className="field"><label>Oficina/Prestador</label>
            <select value={oficina} onChange={(e) => setOficina(e.target.value)}>
              <option value="">— Nenhuma —</option>
              {oficinaOpts.map((v) => <option key={v} value={v}>{v}</option>)}
              <option value={NEW_SENTINEL}>+ Nova oficina...</option>
            </select>
          </div>
        </div>

        <div className="grid c2">
          <div className="field"><label>Nova oficina</label>
            <input className={oficina === NEW_SENTINEL ? "" : "hidden"} placeholder="Nome da nova oficina" value={oficinaNova} onChange={(e) => setOficinaNova(e.target.value)} />
          </div>
        </div>

        <div className="grid c3">
          <div className="field"><label>Agente{exigeVinculos ? " *" : ""}</label>
            <select value={agenteSel} onChange={(e) => setAgenteSel(e.target.value)}>
              <option value="">— Selecione —</option>
              {agenteOpts.map((a) => <option key={a} value={a}>{a}</option>)}
              <option value={NEW_SENTINEL}>+ Novo agente...</option>
            </select>
          </div>
          <div className="field"><label>Novo agente</label>
            <input className={agenteSel === NEW_SENTINEL ? "" : "hidden"} placeholder="Nome do novo agente" value={agenteNovo} onChange={(e) => setAgenteNovo(e.target.value)} />
          </div>
          <div className="field"><label>Produtor{exigeVinculos ? " *" : ""}</label>
            <select value={produtorSel} onChange={(e) => setProdutorSel(e.target.value)}>
              <option value="">— Selecione —</option>
              {produtorOpts.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Produtor não tem cadastro manual — só vem de processos já buscados (Configurações → Agentes e Produtores).</p>
          </div>
        </div>

        <div className="grid c2">
          <div className="field"><label>Responsável{exigeVinculos ? " *" : ""}</label>
            <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              <option value="">— Sem responsável —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </div>
        {exigeVinculos && (
          <p className="muted" style={{ fontSize: 11.5, marginTop: -8, marginBottom: 8 }}>* Agente, Produtor e Responsável são obrigatórios para Segurado/Terceiro.</p>
        )}

        <div className="grid c3">
          <div className="field"><label>Apólice</label><input placeholder="Nº da apólice" value={numapo} onChange={(e) => setNumapo(e.target.value)} /></div>
          <div className="field"><label>Endosso</label><input placeholder="Nº do endosso" value={numend} onChange={(e) => setNumend(e.target.value)} /></div>
          <div className="field"><label>Item</label><input placeholder="Item" value={item} onChange={(e) => setItem(e.target.value)} /></div>
        </div>

        <div className="grid c2">
          <div className="field"><label>Data de ocorrência</label><input type="date" value={datoco} onChange={(e) => setDatoco(e.target.value)} /></div>
          <div className="field"><label>Data de aviso</label><input type="date" value={datavi} onChange={(e) => setDatavi(e.target.value)} /></div>
        </div>

        <div className="grid c2">
          <div className="field"><label>Franquia (R$)</label><input type="number" step="0.01" placeholder="0,00" value={franquia} onChange={(e) => setFranquia(e.target.value)} /></div>
          <div className="field"><label>Valor avaliado (R$)</label><input type="number" step="0.01" placeholder="0,00" value={valavi} onChange={(e) => setValavi(e.target.value)} /></div>
        </div>

        <div className="field"><label>Descrição</label><textarea rows={3} placeholder="Descrição do caso..." value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        <div className="field"><label>Observações</label><textarea rows={3} placeholder="Observações..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>

        <p className="muted" style={{ fontSize: 12 }}>
          O processo já inicia com situação "Pendente". Use o campo "{vinculoLabel()}" acima para já vincular ao Segurado/Terceiro do mesmo evento, herdando seguradora, ramo, apólice, data de ocorrência, agente e produtor.
        </p>

        {status && <div className={"status " + status.cls}>{status.msg}</div>}
        <button className="btn" onClick={criar} disabled={exigeVinculos && (!agenteFinal || !produtorSel || !responsavelId)}>Criar processo</button>
      </div>
    </div>
  );
}
