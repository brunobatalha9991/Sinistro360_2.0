import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "../data/DataProvider.jsx";
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

// Módulo Agenda (a pedido do usuário) — ver logic/agenda.js. Cada
// Atendente/Analista tem a própria agenda; Administrador e VIP consultam e
// editam a de qualquer um, recebem os feedbacks e cuidam da padronização.
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

  const [aba, setAba] = useState(param === "feedbacks" && gestor ? "feedbacks" : "dia");
  const [userIdSel, setUserIdSel] = useState(() => (temAgendaPropria(currentUser) ? currentUser.id : (agendaUsers[0] || {}).id));
  const [dataISO, setDataISO] = useState(dataLocalISO());
  const [modalBloco, setModalBloco] = useState(null); // { bloco, dataDia }
  const [modalModelo, setModalModelo] = useState(false);
  const [pedidoFeedback, setPedidoFeedback] = useState(null); // { oc, tipo }

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
  const podeEditar = !!dono && (ehDono || gestor);
  const hoje = dataLocalISO(agora);
  const ocorrencias = dono ? ocorrenciasDoDia(blocos, dono.id, dataISO) : [];

  function abrirNova(hhmm) {
    const ini = hhmm || minToHHMM(Math.max(hhmmToMin(cfg.inicio), Math.ceil((agora.getHours() * 60 + agora.getMinutes()) / 15) * 15));
    setModalBloco({ bloco: { inicio: ini, fim: minToHHMM(hhmmToMin(ini) + 30), data: dataISO }, dataDia: dataISO });
  }

  function abrirOcorrencia(oc) {
    setModalBloco({ bloco: { ...oc.bloco, inicio: oc.inicio, fim: oc.fim }, dataDia: oc.data });
  }

  function mover(oc, inicio, fim) {
    if (oc.recorrente) actions.salvarExcecao(oc.blocoId, oc.data, { inicio, fim });
    else actions.salvarBloco({ ...oc.bloco, inicio, fim });
  }

  function salvarBloco(form, escopo) {
    const { bloco, dataDia } = modalBloco;
    const original = blocos.find((b) => b.id === bloco.id);
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
    if (escopo === "dia") actions.salvarExcecao(original.id, dataDia, { removida: true });
    else if (escopo === "diante" && dataDia > original.data) actions.salvarBloco({ ...original, recorrencia: { ...original.recorrencia, ate: addDias(dataDia, -1) } });
    else actions.excluirBloco(original.id);
    setModalBloco(null);
  }

  function aplicarModelo({ modelo, userIds, dataInicio, recorrencia, substituir }) {
    actions.aplicarModeloParaUsuarios({ modelo, presets, userIds, dataInicio, recorrencia, substituir, autorId: currentUser.id });
    setModalModelo(false);
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
        <FeedbacksPanel feedbacks={feedbacks} users={users} agendaUsers={agendaUsers} podeVerTodos={gestor} currentUser={currentUser} />
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
            {podeEditar && (
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button className="btn sec sm" onClick={() => setModalModelo(true)}>📋 Aplicar modelo</button>
                <button className="btn sm" onClick={() => abrirNova()}>+ Nova ação</button>
              </div>
            )}
          </div>

          {!dono ? <div className="card"><EmptyState>Nenhum Atendente/Analista cadastrado.</EmptyState></div> : (
            <div className="agenda-layout">
              <div className="card agenda-card-timeline">
                {!ocorrencias.length && (
                  <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                    Nenhuma ação neste dia. {podeEditar ? "Clique num horário da grade para criar, ou use \"Aplicar modelo\" pra montar o dia inteiro." : ""}
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
          bloco={modalBloco.bloco} dataDia={modalBloco.dataDia} presets={presets}
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
