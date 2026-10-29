import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
import { uid } from "../logic/format";
import { useAuth } from "../hooks/useAuth";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAgendaActions } from "../hooks/useAgendaActions";
import { useAgendaAlarme } from "../hooks/useAgendaAlarme";
import { isAdmin } from "../data/auth";
import { EmptyState } from "../components/EmptyState.jsx";
import { FeedbackForm } from "../components/AgendaAlarmeModal.jsx";
import { AgendaDia, STATUS_BADGE } from "../components/agenda/AgendaDia.jsx";
import { BlocoModal } from "../components/agenda/BlocoModal.jsx";
import { AplicarModeloModal } from "../components/agenda/AplicarModeloModal.jsx";
import { FeedbacksPanel } from "../components/agenda/FeedbacksPanel.jsx";
import { IndicadoresPanel } from "../components/agenda/IndicadoresPanel.jsx";
import { AgendaConfigPanel } from "../components/agenda/AgendaConfigPanel.jsx";
import {
  temAgendaPropria, ocorrenciasDoDia, indexarFeedbacks, statusOcorrencia, STATUS_LABEL, FEEDBACK_TIPOS,
  agendaPresets, agendaModelos, dataLocalISO, addDias, parseDataLocal, hhmmToMin, minToHHMM, fmtHoraDe,
  fmtDataBRCurta, modeloDoDia, rotuloAcao,
} from "../logic/agenda";

const DIAS_EXTENSO = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const CAMPOS_ALEM_DO_HORARIO = ["titulo", "icone", "cor", "tipo", "pausa", "lembreteMin", "descricao", "presetId"];

function FeedbackManualModal({ pedido, cfg, onConfirmar, onClose }) {
  const t = FEEDBACK_TIPOS[pedido.tipo];
  return createPortal(
    <div className="agenda-modal-fundo" onClick={onClose}>
      <div className="agenda-modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0 }}>{t.label}: {pedido.oc.icone} {pedido.oc.titulo}</h3>
        <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>Previsto {pedido.oc.inicio}{pedido.oc.tipo === "marco" ? "" : "–" + pedido.oc.fim}</p>
        <FeedbackForm tipo={pedido.tipo} minChars={cfg.feedbackMinChars} onVoltar={onClose} onConfirmar={onConfirmar} />
      </div>
    </div>,
    document.body,
  );
}

// Motivo obrigatório antes de o Atendente/Analista alterar a agenda.
function MotivoAlteracaoModal({ dataISO, cfg, onConfirmar, onClose }) {
  return createPortal(
    <div className="agenda-modal-fundo" onClick={onClose}>
      <div className="agenda-modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0 }}>✏️ Alterar agenda de {fmtDataBRCurta(dataISO)}</h3>
        <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
          O motivo e tudo o que você mudar em seguida ficam registrados e o gestor é avisado. A alteração vale só para este dia.
        </p>
        <FeedbackForm tipo="alteracao" minChars={cfg.feedbackMinChars} onVoltar={onClose} onConfirmar={onConfirmar} />
      </div>
    </div>,
    document.body,
  );
}

// Grava o dia montado como modelo de dia ("preset" da agenda) — novo ou
// substituindo um existente.
function SalvarPresetModal({ nomeInicial, modelos, onSalvar, onClose }) {
  const [nome, setNome] = useState(nomeInicial);
  const [substituirId, setSubstituirId] = useState("");
  const valido = substituirId || nome.trim();
  return createPortal(
    <div className="agenda-modal-fundo" onClick={onClose}>
      <div className="agenda-modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <h3 style={{ margin: 0 }}>💾 Salvar preset da agenda</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>O dia como está agora vira um modelo de dia — fica em "Presets e modelos" e no "Aplicar modelo".</p>
        <div className="field">
          <label>Salvar como</label>
          <select value={substituirId} onChange={(e) => setSubstituirId(e.target.value)}>
            <option value="">Novo modelo</option>
            {modelos.map((m) => <option key={m.id} value={m.id}>Substituir: {m.nome}</option>)}
          </select>
        </div>
        {!substituirId && (
          <div className="field">
            <label>Nome do modelo</label>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn sm" disabled={!valido} onClick={() => onSalvar({ nome: nome.trim(), substituirId })}>Salvar preset</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Módulo Agenda (a pedido do usuário) — ver logic/agenda.js. Cada
// Atendente/Analista tem a própria agenda, montada pelo gestor: ele só
// altera um dia (hoje ou futuro) depois de clicar em "Alterar agenda" e
// registrar o motivo — o motivo e cada mudança ficam num feedback tipo
// "alteracao" e o gestor é notificado. Administrador e VIP consultam e
// editam a de qualquer um livremente, recebem os feedbacks e cuidam da
// padronização; depois de editar um dia, podem salvá-lo como preset
// (modelo de dia) ou torná-lo recorrente.
export function Agenda() {
  const { records, config, saveConfig } = useData();
  const { currentUser } = useAuth();
  const { param } = useHashRoute();
  const actions = useAgendaActions();
  const { cfg, agora } = useAgendaAlarme(null);

  const users = records.corp_users || [];
  const blocos = records.corp_agenda || [];
  const feedbacks = records.corp_agenda_feedback || [];
  const presets = agendaPresets(config);
  const modelos = agendaModelos(config);
  const gestor = isAdmin(currentUser);
  const agendaUsers = useMemo(() => (records.corp_users || []).filter(temAgendaPropria).sort((a, b) => a.nome.localeCompare(b.nome)), [records.corp_users]);

  const [aba, setAba] = useState(param === "feedbacks" ? "feedbacks" : "dia");
  const [userIdSel, setUserIdSel] = useState(() => (temAgendaPropria(currentUser) ? currentUser.id : (agendaUsers[0] || {}).id));
  const [dataISO, setDataISO] = useState(dataLocalISO());
  const [modalBloco, setModalBloco] = useState(null); // { bloco, dataDia }
  const [modalModelo, setModalModelo] = useState(false);
  const [pedidoFeedback, setPedidoFeedback] = useState(null); // { oc, tipo }
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const [alteracao, setAlteracao] = useState(null); // { feedbackId, userId, data, motivo } — operador
  const [editadosGestor, setEditadosGestor] = useState({}); // "userId|data" -> true
  const [modalPreset, setModalPreset] = useState(false);
  const [modalRecorrente, setModalRecorrente] = useState(false);

  const idx = useMemo(() => indexarFeedbacks(records.corp_agenda_feedback || []), [records.corp_agenda_feedback]);

  if (!gestor && !temAgendaPropria(currentUser)) {
    return (
      <div className="page-enter">
        <div className="page-head"><div><h1>Agenda</h1></div></div>
        <div className="card"><EmptyState>A agenda é individual de Atendentes e Analistas — seu perfil não tem agenda própria.</EmptyState></div>
      </div>
    );
  }

  const userId = gestor ? userIdSel : currentUser.id;
  const dono = users.find((u) => u.id === userId);
  const ehDono = !!dono && dono.id === currentUser.id;
  const hoje = dataLocalISO(agora);
  const ocorrencias = dono ? ocorrenciasDoDia(blocos, dono.id, dataISO) : [];
  const emAlteracao = !gestor && ehDono && !!alteracao && alteracao.userId === userId && alteracao.data === dataISO;
  const podeEditar = !!dono && (gestor || emAlteracao);
  const podeAlterar = !gestor && ehDono && dataISO >= hoje && ocorrencias.length > 0 && !emAlteracao;
  const chaveDia = userId + "|" + dataISO;
  const gestorEditou = gestor && !!dono && !!editadosGestor[chaveDia];

  // Toda edição: o gestor ganha os botões de preset/recorrente; o
  // operador em "Alterar agenda" registra a mudança no motivo aberto.
  function registrarEdicao(texto) {
    if (gestor) setEditadosGestor((cur) => (cur[chaveDia] ? cur : { ...cur, [chaveDia]: true }));
    else if (emAlteracao) actions.registrarMudancaAgenda(alteracao.feedbackId, texto);
  }

  function iniciarAlteracao(motivo) {
    const feedbackId = actions.iniciarAlteracao({ dono, data: dataISO, motivo, autor: currentUser });
    setAlteracao({ feedbackId, userId, data: dataISO, motivo: motivo.trim() });
    setPedirMotivo(false);
  }

  function salvarPreset({ nome, substituirId }) {
    const atual = substituirId ? modelos.find((m) => m.id === substituirId) : null;
    const novo = modeloDoDia(ocorrencias, { id: atual ? atual.id : uid("am"), nome: atual ? atual.nome : nome });
    saveConfig("corp_agenda_modelos", atual ? modelos.map((m) => (m.id === atual.id ? novo : m)) : [...modelos, novo]);
    setModalPreset(false);
  }

  function abrirNova(hhmm) {
    const ini = hhmm || minToHHMM(Math.max(hhmmToMin(cfg.inicio), Math.ceil((agora.getHours() * 60 + agora.getMinutes()) / 15) * 15));
    setModalBloco({ bloco: { inicio: ini, fim: minToHHMM(hhmmToMin(ini) + 30), data: dataISO }, dataDia: dataISO });
  }

  function abrirOcorrencia(oc) {
    if (!podeEditar) return;
    setModalBloco({ bloco: { ...oc.bloco, inicio: oc.inicio, fim: oc.fim }, dataDia: oc.data });
  }

  function mover(oc, inicio, fim) {
    if (oc.recorrente) actions.salvarExcecao(oc.blocoId, oc.data, { inicio, fim });
    else actions.salvarBloco({ ...oc.bloco, inicio, fim });
    registrarEdicao(`Mudou o horário de ${rotuloAcao(oc)} para ${oc.tipo === "marco" ? inicio : `${inicio}–${fim}`}`);
  }

  function salvarBloco(form, escopo) {
    const { bloco, dataDia } = modalBloco;
    const original = blocos.find((b) => b.id === bloco.id);
    registrarEdicao(original ? `Editou ${rotuloAcao(bloco)} → ${rotuloAcao(form)}` : `Criou ${rotuloAcao(form)}`);
    if (!original) {
      actions.salvarBloco({ ...form, userId: dono.id, criadoPor: currentUser.id });
    } else if (original.recorrencia && original.recorrencia.tipo !== "nenhuma" && escopo === "dia") {
      // Só o horário mudou: exceção do dia (mantém o vínculo com os
      // feedbacks já registrados). Mudou mais que isso: o dia sai da
      // série e vira uma ação avulsa.
      const norm = (k, v) => (k === "pausa" ? !!v : String(v ?? ""));
      const soHorario = CAMPOS_ALEM_DO_HORARIO.every((k) => norm(k, form[k]) === norm(k, original[k]));
      if (soHorario) {
        actions.salvarExcecao(original.id, dataDia, { inicio: form.inicio, fim: form.fim });
      } else {
        actions.salvarExcecao(original.id, dataDia, { removida: true });
        actions.salvarBloco({ ...form, userId: original.userId, data: dataDia, recorrencia: { tipo: "nenhuma" }, excecoes: {}, criadoPor: currentUser.id });
      }
    } else {
      actions.salvarBloco({ ...original, ...form });
    }
    setModalBloco(null);
  }

  function excluirBloco(escopo) {
    const { bloco, dataDia } = modalBloco;
    const original = blocos.find((b) => b.id === bloco.id);
    if (!original) { setModalBloco(null); return; }
    registrarEdicao(`Excluiu ${rotuloAcao(bloco)}`);
    if (escopo === "dia") actions.salvarExcecao(original.id, dataDia, { removida: true });
    else if (escopo === "diante" && dataDia > original.data) actions.salvarBloco({ ...original, recorrencia: { ...original.recorrencia, ate: addDias(dataDia, -1) } });
    else actions.excluirBloco(original.id);
    setModalBloco(null);
  }

  function aplicarModelo({ modelo, userIds, dataInicio, recorrencia, substituir }) {
    actions.aplicarModeloParaUsuarios({ modelo, presets, userIds, dataInicio, recorrencia, substituir, autorId: currentUser.id });
    if (userIds.indexOf(userId) >= 0) registrarEdicao(`Aplicou o modelo ${modelo.nome}`);
    setModalModelo(false);
    setModalRecorrente(false);
  }

  const contagem = {};
  ocorrencias.forEach((oc) => { const s = statusOcorrencia(oc, idx, agora); contagem[s] = (contagem[s] || 0) + 1; });
  const feedbacksDoDia = (key) => feedbacks.filter((f) => f.blocoId + "|" + f.data === key).sort((a, b) => String(a.at).localeCompare(String(b.at)));

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Agenda</h1>
          <p>Planejamento do dia em blocos de tempo — com alarme pra iniciar e finalizar cada ação e feedback obrigatório.</p>
        </div>
      </div>

      <div className="tabs">
        <div className={"tab" + (aba === "dia" ? " active" : "")} onClick={() => setAba("dia")}>Agenda do dia</div>
        <div className={"tab" + (aba === "feedbacks" ? " active" : "")} onClick={() => setAba("feedbacks")}>{gestor ? "Feedbacks da equipe" : "Meus feedbacks"}</div>
        <div className={"tab" + (aba === "indicadores" ? " active" : "")} onClick={() => setAba("indicadores")}>Indicadores</div>
        {gestor && <div className={"tab" + (aba === "config" ? " active" : "")} onClick={() => setAba("config")}>Presets e modelos</div>}
      </div>

      {aba === "feedbacks" && (
        <FeedbacksPanel feedbacks={feedbacks} users={users} agendaUsers={agendaUsers} podeVerTodos={gestor} currentUser={currentUser} onComentar={actions.comentarFeedback} />
      )}
      {aba === "indicadores" && (
        <IndicadoresPanel blocos={blocos} feedbacks={feedbacks} agendaUsers={gestor ? agendaUsers : agendaUsers.filter((u) => u.id === currentUser.id)} userIdSelecionado={userId} podeVerTodos={gestor} cfg={cfg} />
      )}
      {aba === "config" && gestor && <AgendaConfigPanel config={config} saveConfig={saveConfig} />}

      {aba === "dia" && (
        <>
          <div className="card agenda-toolbar">
            {gestor && (
              <select value={userId || ""} onChange={(e) => setUserIdSel(e.target.value)} style={{ width: "auto", minWidth: 200 }}>
                {!agendaUsers.length && <option value="">Nenhum Atendente/Analista</option>}
                {agendaUsers.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.id === currentUser.id ? " (você)" : ""}</option>)}
              </select>
            )}
            <div className="agenda-navdia">
              <button className="btn sec xs" onClick={() => setDataISO(addDias(dataISO, -1))} title="Dia anterior">◀</button>
              <button className={"btn xs" + (dataISO === hoje ? "" : " sec")} onClick={() => setDataISO(hoje)}>Hoje</button>
              <button className="btn sec xs" onClick={() => setDataISO(addDias(dataISO, 1))} title="Próximo dia">▶</button>
              <input type="date" className="inline" value={dataISO} onChange={(e) => e.target.value && setDataISO(e.target.value)} />
              <b style={{ fontSize: 13 }}>{DIAS_EXTENSO[parseDataLocal(dataISO).getDay()]}</b>
            </div>
            {gestor && dono && (
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button className="btn sec sm" onClick={() => setModalModelo(true)}>📋 Aplicar modelo</button>
                <button className="btn sm" onClick={() => abrirNova()}>+ Nova ação</button>
              </div>
            )}
            {emAlteracao && (
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button className="btn sec sm" onClick={() => abrirNova()}>+ Nova ação</button>
                <button className="btn sm" onClick={() => setAlteracao(null)}>✓ Concluir alteração</button>
              </div>
            )}
            {podeAlterar && (
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button className="btn sm" onClick={() => setPedirMotivo(true)}>✏️ Alterar agenda</button>
              </div>
            )}
          </div>

          {emAlteracao && (
            <div className="card" style={{ borderLeft: "4px solid var(--warn, #f59e0b)", fontSize: 13 }}>
              <b>Alterando a agenda de {fmtDataBRCurta(dataISO)}.</b> Motivo: {alteracao.motivo}
              <div className="muted" style={{ fontSize: 12 }}>Tudo o que você mudar vale só para este dia e fica registrado para o gestor. Clique em "Concluir alteração" ao terminar.</div>
            </div>
          )}
          {gestorEditou && (
            <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderLeft: "4px solid var(--primary, #2f6bff)" }}>
              <span style={{ fontSize: 13, flex: 1, minWidth: 220 }}>Você alterou a agenda de <b>{dono.nome}</b> em {fmtDataBRCurta(dataISO)}.</span>
              <button className="btn sec sm" disabled={!ocorrencias.length} onClick={() => setModalPreset(true)}>💾 Salvar preset</button>
              <button className="btn sm" disabled={!ocorrencias.length} onClick={() => setModalRecorrente(true)}>🔁 Tornar recorrente</button>
            </div>
          )}

          {!dono ? <div className="card"><EmptyState>Nenhum Atendente/Analista cadastrado.</EmptyState></div> : (
            <div className="agenda-layout">
              <div className="card agenda-card-timeline">
                {!ocorrencias.length && (
                  <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                    Nenhuma ação neste dia. {gestor ? "Clique num horário da grade para criar, ou use \"Aplicar modelo\" pra montar o dia inteiro." : emAlteracao ? "Clique num horário da grade para criar uma ação." : "Sua agenda é montada pelo gestor."}
                  </p>
                )}
                <AgendaDia
                  ocorrencias={ocorrencias} idx={idx} agora={agora} cfg={cfg} ehHoje={dataISO === hoje}
                  podeEditar={podeEditar} onCriar={abrirNova} onAbrir={abrirOcorrencia} onMover={mover}
                />
                {podeEditar && <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>Arraste uma ação para mudar o horário, puxe a borda de baixo para mudar a duração, clique para editar. ↻ = ação que se repete.</p>}
              </div>

              <div className="card agenda-roteiro">
                <h3 style={{ marginTop: 0 }}>Roteiro {dataISO === hoje ? "de hoje" : "do dia"}{!ehDono ? ` — ${dono.nome}` : ""}</h3>
                <div className="chips">
                  {Object.keys(STATUS_LABEL).filter((s) => contagem[s]).map((s) => (
                    <span key={s} className={"badge " + STATUS_BADGE[s]}>{STATUS_LABEL[s]}: {contagem[s]}</span>
                  ))}
                </div>
                {!ocorrencias.length ? <EmptyState>Nada planejado.</EmptyState> : ocorrencias.map((oc) => {
                  const st = statusOcorrencia(oc, idx, agora);
                  const e = idx[oc.key] || {};
                  const fbs = feedbacksDoDia(oc.key);
                  const podeAgir = ehDono && dataISO === hoje && !e.fim && !e.nao_realizada;
                  return (
                    <div key={oc.key} className="agenda-roteiro-item" style={{ "--bloco-cor": oc.cor }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{oc.inicio}{oc.tipo === "marco" ? "" : "–" + oc.fim}{oc.recorrente ? " ↻" : ""}</div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{oc.icone} {oc.titulo}</div>
                          {oc.descricao && <div className="muted" style={{ fontSize: 12 }}>{oc.descricao}</div>}
                        </div>
                        <span className={"badge " + STATUS_BADGE[st]} style={{ flexShrink: 0 }}>{STATUS_LABEL[st]}</span>
                      </div>
                      {podeAgir && (
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          {oc.tipo !== "marco" && !e.inicio && <button className="btn xs" onClick={() => setPedidoFeedback({ oc, tipo: "inicio" })}>▶ Iniciar</button>}
                          {(e.inicio || oc.tipo === "marco") && <button className="btn xs" onClick={() => setPedidoFeedback({ oc, tipo: "fim" })}>✓ Marcar como feito</button>}
                        </div>
                      )}
                      {fbs.length > 0 && (
                        <div className="agenda-roteiro-fbs">
                          {fbs.map((f) => (
                            <div key={f.id}>
                              <span className={"badge " + ((FEEDBACK_TIPOS[f.tipo] || {}).badge || "gray")} style={{ fontSize: 10 }}>{(FEEDBACK_TIPOS[f.tipo] || {}).label || f.tipo} {fmtHoraDe(f.at)}</span>{" "}
                              <span style={{ fontSize: 12 }}>{f.texto}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {modalBloco && (
        <BlocoModal
          key={(modalBloco.bloco.id || "novo") + modalBloco.dataDia}
          bloco={modalBloco.bloco} dataDia={modalBloco.dataDia} presets={presets} soDia={!gestor}
          onSalvar={salvarBloco} onExcluir={excluirBloco} onClose={() => setModalBloco(null)}
        />
      )}
      {modalModelo && (
        <AplicarModeloModal
          modelos={modelos} presets={presets} agendaUsers={agendaUsers} userIdInicial={userId}
          podeEscolherUsuarios={gestor} dataInicial={dataISO}
          onAplicar={aplicarModelo} onClose={() => setModalModelo(false)}
        />
      )}
      {pedirMotivo && (
        <MotivoAlteracaoModal dataISO={dataISO} cfg={cfg} onConfirmar={iniciarAlteracao} onClose={() => setPedirMotivo(false)} />
      )}
      {modalPreset && (
        <SalvarPresetModal nomeInicial={`Agenda ${dono ? dono.nome : ""} ${fmtDataBRCurta(dataISO)}`.trim()} modelos={modelos} onSalvar={salvarPreset} onClose={() => setModalPreset(false)} />
      )}
      {modalRecorrente && (
        <AplicarModeloModal
          modelos={[modeloDoDia(ocorrencias, { id: "__dia__", nome: `Agenda de ${fmtDataBRCurta(dataISO)}` })]}
          presets={presets} agendaUsers={agendaUsers} userIdInicial={userId}
          podeEscolherUsuarios dataInicial={addDias(dataISO, 1)}
          titulo={`🔁 Tornar recorrente — agenda de ${fmtDataBRCurta(dataISO)}`} textoBotao="Tornar recorrente"
          onAplicar={aplicarModelo} onClose={() => setModalRecorrente(false)}
        />
      )}
      {pedidoFeedback && (
        <FeedbackManualModal
          pedido={pedidoFeedback} cfg={cfg} onClose={() => setPedidoFeedback(null)}
          onConfirmar={(texto) => {
            actions.registrarFeedback({ oc: pedidoFeedback.oc, tipo: pedidoFeedback.tipo, texto, autor: currentUser });
            setPedidoFeedback(null);
          }}
        />
      )}
    </div>
  );
}
