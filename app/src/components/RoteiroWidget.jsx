import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useAgendaActions } from "../hooks/useAgendaActions";
import { FeedbackForm } from "./AgendaAlarmeModal.jsx";
import { agendaCfg, temAgendaPropria, minToHHMM, fmtPct, fmtMin, STATUS_LABEL } from "../logic/agenda";
import { resumoRoteiro, fmtCronometro } from "../logic/roteiroDia";
import { isAdmin } from "../data/auth";
import { intervencoesPendentes } from "../logic/tasks";

// Roteiro do dia na barra superior (a pedido do usuário): para quem tem
// Agenda (Atendente/Analista), um chip vivo com a ação atual e a contagem
// regressiva, e um painel com cronômetro, próximas ações, pendências,
// progresso do dia, CIs abertas e um cronômetro livre. Para Admin/VIP sem
// agenda própria, o mesmo chip mostra a equipe agora. Ver logic/roteiroDia.js.

const ESTADOS = {
  estourada: { cls: "danger", icone: "⏰" },
  atrasada: { cls: "warn", icone: "⚠️" },
  encerrando: { cls: "warn", icone: "⏳" },
  em_andamento: { cls: "run", icone: "▶" },
  em_breve: { cls: "soon", icone: "🔔" },
  livre: { cls: "idle", icone: "☕" },
  fim: { cls: "ok", icone: "✓" },
  sem_agenda: { cls: "idle", icone: "🗓" },
};

function hhmmDe(ms) { const d = new Date(ms); return minToHHMM(d.getHours() * 60 + d.getMinutes()); }
function emQuanto(ms) {
  const min = Math.ceil(ms / 60000);
  if (min <= 0) return "agora";
  if (min < 60) return `em ${min} min`;
  return `em ${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function lerLocal(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v == null ? padrao : JSON.parse(v); } catch { return padrao; }
}
function gravarLocal(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* ignore */ }
}

function textoChip(r, t) {
  const a = r.atual;
  switch (r.estado) {
    case "estourada": return { titulo: `${a.oc.icone} ${a.oc.titulo}`, tempo: fmtCronometro(a.fimMs - t), dica: "passou do horário previsto" };
    case "atrasada": return { titulo: `Iniciar: ${a.oc.titulo}`, tempo: fmtCronometro(t - a.iniMs), dica: "começou e não foi iniciada" };
    case "encerrando":
    case "em_andamento": return { titulo: `${a.oc.icone} ${a.oc.titulo}`, tempo: fmtCronometro(a.fimMs - t), dica: "para terminar" };
    case "em_breve": return { titulo: `Próxima: ${r.proxima.oc.titulo}`, tempo: fmtCronometro(r.proxima.iniMs - t), dica: "para começar" };
    case "livre": return { titulo: "Livre", tempo: hhmmDe(r.proxima.iniMs), dica: `próxima: ${r.proxima.oc.titulo}` };
    case "fim": return { titulo: "Dia concluído", tempo: "", dica: "nada mais na agenda hoje" };
    default: return { titulo: "Agenda vazia", tempo: "", dica: "monte o seu dia na Agenda" };
  }
}

function Barra({ valor, cor }) {
  return (
    <div className="roteiro-barra"><div style={{ width: `${Math.round(Math.min(1, Math.max(0, valor || 0)) * 100)}%`, background: cor }} /></div>
  );
}

// Cronômetro livre (pausa/retoma/zera), guardado por usuário neste navegador.
function CronometroLivre({ userId, t }) {
  const chave = "s360_crono_" + userId;
  const [c, setC] = useState(() => lerLocal(chave, { rodandoDesde: null, acumuladoMs: 0 }));
  const salvar = (v) => { setC(v); gravarLocal(chave, v); };
  const total = c.acumuladoMs + (c.rodandoDesde ? t - c.rodandoDesde : 0);
  return (
    <div className="roteiro-crono-livre">
      <div>
        <div className="roteiro-rotulo">Cronômetro livre</div>
        <div className="roteiro-num">{fmtCronometro(total)}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {c.rodandoDesde
          ? <button className="btn sec xs" onClick={() => salvar({ rodandoDesde: null, acumuladoMs: total })}>⏸ Pausar</button>
          : <button className="btn sec xs" onClick={() => salvar({ rodandoDesde: Date.now(), acumuladoMs: c.acumuladoMs })}>▶ {c.acumuladoMs ? "Retomar" : "Iniciar"}</button>}
        <button className="btn ghost xs" disabled={!total} onClick={() => salvar({ rodandoDesde: null, acumuladoMs: 0 })}>Zerar</button>
      </div>
    </div>
  );
}

function PainelPessoal({ r, t, cfg, currentUser, navigate, ciInfo, onFechar }) {
  const actions = useAgendaActions();
  const [acao, setAcao] = useState(null); // {x, tipo}
  const a = r.atual;
  const p = r.progresso;

  function registrar(texto) {
    actions.registrarFeedback({ oc: acao.x.oc, tipo: acao.tipo, texto, autor: currentUser });
    setAcao(null);
  }

  return (
    <div className="roteiro-painel" onClick={(e) => e.stopPropagation()}>
      <div className="roteiro-painel-topo">
        <strong>Roteiro de hoje</strong>
        <button className="btn ghost xs" onClick={() => { onFechar(); navigate("agenda"); }}>Abrir Agenda →</button>
      </div>

      {/* AGORA */}
      <div className={"roteiro-agora est-" + (ESTADOS[r.estado] || {}).cls}>
        {a ? (
          <>
            <div className="roteiro-rotulo">{a.status === "em_andamento" ? "Em andamento" : "Deveria estar fazendo agora"}</div>
            <div className="roteiro-agora-titulo">{a.oc.icone} {a.oc.titulo}</div>
            <div className="muted" style={{ fontSize: 12 }}>Previsto {a.oc.inicio}–{a.oc.fim}{a.inicioRealMs ? ` • iniciada às ${hhmmDe(a.inicioRealMs)}` : ""}</div>
            <div className="roteiro-relogios">
              <div>
                <div className="roteiro-rotulo">Cronômetro</div>
                <div className="roteiro-num">{fmtCronometro(t - (a.inicioRealMs || a.iniMs))}</div>
              </div>
              <div>
                <div className="roteiro-rotulo">{t > a.fimMs ? "Passou do previsto" : "Falta"}</div>
                <div className={"roteiro-num" + (t > a.fimMs ? " neg" : "")}>{fmtCronometro(a.fimMs - t)}</div>
              </div>
            </div>
            <Barra valor={(t - a.iniMs) / Math.max(1, a.fimMs - a.iniMs)} cor={t > a.fimMs ? "rgb(var(--danger-rgb))" : a.oc.cor} />
            {!acao && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {a.status === "em_andamento"
                  ? <button className="btn sm" onClick={() => setAcao({ x: a, tipo: "fim" })}>✓ Finalizar</button>
                  : <button className="btn sm" onClick={() => setAcao({ x: a, tipo: "inicio" })}>▶ Iniciar agora</button>}
              </div>
            )}
          </>
        ) : r.proxima ? (
          <>
            <div className="roteiro-rotulo">Nada agora • próxima ação</div>
            <div className="roteiro-agora-titulo">{r.proxima.oc.icone} {r.proxima.oc.titulo}</div>
            <div className="roteiro-relogios">
              <div>
                <div className="roteiro-rotulo">Começa às {r.proxima.oc.inicio} — faltam</div>
                <div className="roteiro-num">{fmtCronometro(r.proxima.iniMs - t)}</div>
              </div>
            </div>
            {!acao && <button className="btn sec sm" style={{ marginTop: 8 }} onClick={() => setAcao({ x: r.proxima, tipo: "inicio" })}>▶ Adiantar e iniciar</button>}
          </>
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>{r.estado === "sem_agenda" ? "Nenhuma ação na agenda de hoje. Monte o seu dia na Agenda." : "Todas as ações de hoje já passaram. Bom trabalho!"}</div>
        )}
        {acao && (
          <FeedbackForm key={acao.tipo + acao.x.oc.key} tipo={acao.tipo} minChars={cfg.feedbackMinChars} compacto onVoltar={() => setAcao(null)} onConfirmar={registrar} />
        )}
      </div>

      {/* ATENÇÃO */}
      {r.alertas > 0 && (
        <div className="roteiro-secao">
          <div className="roteiro-secao-titulo">⚠️ Atenção ({r.alertas})</div>
          {r.estouradas.map((x) => (
            <div key={x.oc.key} className="roteiro-linha danger">⏰ <b>{x.oc.titulo}</b> passou {fmtCronometro(t - x.fimMs)} do fim previsto ({x.oc.fim})</div>
          ))}
          {r.atrasadas.filter((x) => x !== a).map((x) => (
            <div key={x.oc.key} className="roteiro-linha warn">▶ <b>{x.oc.titulo}</b> começou às {x.oc.inicio} e não foi iniciada</div>
          ))}
          {r.semRegistro.map((x) => (
            <div key={x.oc.key} className="roteiro-linha danger">✗ <b>{x.oc.titulo}</b> ({x.oc.inicio}{x.oc.tipo === "marco" ? "" : "–" + x.oc.fim}) ficou sem registro</div>
          ))}
        </div>
      )}

      {/* PRÓXIMAS */}
      {r.proximas.length > 0 && (
        <div className="roteiro-secao">
          <div className="roteiro-secao-titulo">Próximas</div>
          {r.proximas.slice(0, 5).map((x) => (
            <div key={x.oc.key} className="roteiro-prox">
              <span className="roteiro-prox-cor" style={{ background: x.oc.cor }} />
              <span className="mono" style={{ fontSize: 12 }}>{x.oc.inicio}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.oc.icone} {x.oc.titulo}</span>
              <span className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{emQuanto(x.iniMs - t)}</span>
            </div>
          ))}
        </div>
      )}

      {/* DIA */}
      {p.total > 0 && (
        <div className="roteiro-secao">
          <div className="roteiro-secao-titulo">Meu dia</div>
          <div className="roteiro-kv"><span>Ações concluídas</span><b>{p.concluidas}/{p.total}</b></div>
          <Barra valor={p.pctConcluidas} cor="rgb(var(--ok-rgb))" />
          <div className="roteiro-kv" style={{ marginTop: 8 }}><span>Expediente decorrido</span><b>{fmtPct(p.pctExpediente)}</b></div>
          <Barra valor={p.pctExpediente} cor="rgb(var(--brand-rgb))" />
          <div className="roteiro-grade">
            <div><span>Executado</span><b>{fmtMin(Math.round(p.minExecutados))}</b></div>
            <div><span>Planejado</span><b>{fmtMin(Math.round(p.minPlanejados))}</b></div>
            <div><span>Pontualidade</span><b>{fmtPct(p.pontualidade)}</b></div>
            <div><span>Resta do expediente</span><b>{fmtMin(Math.round(p.restanteExpedienteMin))}</b></div>
          </div>
          {p.pctConcluidas != null && p.vencidas > p.concluidas && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              {p.vencidas - p.concluidas} ação(ões) que já deveriam ter terminado ainda não foram concluídas.
            </div>
          )}
        </div>
      )}

      {/* CIs */}
      {(ciInfo.abertas > 0 || ciInfo.intervencoes > 0) && (
        <div className="roteiro-secao">
          <div className="roteiro-secao-titulo">Comunicação Interna</div>
          <button type="button" className="roteiro-linha link" onClick={() => { onFechar(); navigate("tarefas"); }}>
            📨 {ciInfo.abertas} CI(s) aberta(s) para você{ciInfo.urgentes ? <> • <b style={{ color: "rgb(var(--danger-rgb))" }}>{ciInfo.urgentes} urgente(s)</b></> : null}{ciInfo.intervencoes ? ` • ${ciInfo.intervencoes} intervenção(ões) aguardando` : ""}
          </button>
        </div>
      )}

      <div className="roteiro-secao">
        <CronometroLivre userId={currentUser.id} t={t} />
      </div>
    </div>
  );
}

function PainelEquipe({ equipe, t, navigate, onFechar }) {
  return (
    <div className="roteiro-painel" onClick={(e) => e.stopPropagation()}>
      <div className="roteiro-painel-topo">
        <strong>Equipe agora</strong>
        <button className="btn ghost xs" onClick={() => { onFechar(); navigate("agenda"); }}>Abrir Agenda →</button>
      </div>
      {!equipe.length && <p className="muted" style={{ fontSize: 13 }}>Nenhum Atendente/Analista cadastrado.</p>}
      {equipe.map(({ u, r }) => {
        const a = r.atual;
        const est = ESTADOS[r.estado] || {};
        return (
          <div key={u.id} className={"roteiro-equipe est-" + est.cls}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <b>{u.nome}</b>
              {r.alertas > 0 && <span className="badge red">{r.alertas} alerta(s)</span>}
            </div>
            <div style={{ fontSize: 12.5 }}>
              {a ? <>{est.icone} {a.oc.titulo} — {a.status === "em_andamento" ? (t > a.fimMs ? `passou ${fmtCronometro(t - a.fimMs)}` : `falta ${fmtCronometro(a.fimMs - t)}`) : STATUS_LABEL[a.status]}</>
                : r.proxima ? <>☕ Livre • próxima {r.proxima.oc.inicio} {r.proxima.oc.titulo}</>
                  : <span className="muted">{r.estado === "sem_agenda" ? "Sem agenda hoje" : "Dia concluído"}</span>}
            </div>
            {r.progresso.total > 0 && <div className="muted" style={{ fontSize: 11.5 }}>{r.progresso.concluidas}/{r.progresso.total} ações concluídas • pontualidade {fmtPct(r.progresso.pontualidade)}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function RoteiroWidget({ currentUser, navigate }) {
  const { records, config } = useData();
  const [t, setT] = useState(() => Date.now());
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const pessoal = temAgendaPropria(currentUser);
  const gestor = !pessoal && isAdmin(currentUser);
  const cfg = agendaCfg(config);

  useEffect(() => {
    if (!pessoal && !gestor) return undefined;
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pessoal, gestor]);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("pointerdown", fora, true);
    return () => document.removeEventListener("pointerdown", fora, true);
  }, [aberto]);

  const agora = new Date(t);
  const minuto = Math.floor(t / 60000);
  const blocos = records.corp_agenda;
  const feedbacks = records.corp_agenda_feedback;
  const r = pessoal ? resumoRoteiro({ blocos, feedbacks, userId: currentUser.id, agora, cfg }) : null;

  const equipe = useMemo(() => {
    if (!gestor) return [];
    return (records.corp_users || []).filter(temAgendaPropria).map((u) => ({ u, r: resumoRoteiro({ blocos, feedbacks, userId: u.id, agora: new Date(), cfg }) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestor, records.corp_users, blocos, feedbacks, minuto, config.corp_agenda_cfg]);

  const tasks = records.corp_tasks;
  const ciInfo = useMemo(() => {
    if (!pessoal) return { abertas: 0, urgentes: 0, intervencoes: 0 };
    const minhas = (tasks || []).filter((x) => x && (x.destinatarios || []).includes(currentUser.id) && x.origem !== currentUser.id && x.status !== "Concluído" && !x.arquivadoManualmente);
    return { abertas: minhas.length, urgentes: minhas.filter((x) => x.urgencia === "Urgente").length, intervencoes: intervencoesPendentes(tasks, currentUser.id).length };
  }, [pessoal, tasks, currentUser]);

  // Contagem regressiva no título da aba — ajuda quando o sistema está em
  // outra aba ou minimizado.
  const tituloAba = r && r.atual && r.atual.status === "em_andamento" ? `${t > r.atual.fimMs ? "⏰ +" : "⏱ "}${fmtCronometro(Math.abs(r.atual.fimMs - t))} · ${r.atual.oc.titulo}` : null;
  const tituloOriginal = useRef(null);
  useEffect(() => {
    if (tituloOriginal.current == null) tituloOriginal.current = document.title;
    document.title = tituloAba ? `${tituloAba} — ${tituloOriginal.current}` : tituloOriginal.current;
  }, [tituloAba]);
  useEffect(() => () => { if (tituloOriginal.current != null) document.title = tituloOriginal.current; }, []);

  if (!pessoal && !gestor) return null;

  if (gestor) {
    const alertas = equipe.reduce((s, x) => s + x.r.alertas, 0);
    const ativos = equipe.filter((x) => x.r.atual && x.r.atual.status === "em_andamento").length;
    return (
      <div className="roteiro" ref={ref}>
        <button type="button" className={"roteiro-chip est-" + (alertas ? "warn" : "idle")} onClick={() => setAberto((v) => !v)} title="Agenda da equipe agora">
          <span className="roteiro-chip-icone">👥</span>
          <span className="roteiro-chip-texto"><b>Equipe</b><span>{ativos} em ação{alertas ? ` • ${alertas} alerta(s)` : ""}</span></span>
          {alertas > 0 && <span className="notif-count">{alertas}</span>}
        </button>
        {aberto && <PainelEquipe equipe={equipe} t={t} navigate={navigate} onFechar={() => setAberto(false)} />}
      </div>
    );
  }

  const est = ESTADOS[r.estado] || ESTADOS.sem_agenda;
  const chip = textoChip(r, t);
  const a = r.atual;
  const progressoAtual = a && a.status === "em_andamento" ? (t - a.iniMs) / Math.max(1, a.fimMs - a.iniMs) : null;
  const totalBadge = r.alertas + ciInfo.intervencoes;
  return (
    <div className="roteiro" ref={ref}>
      <button type="button" className={"roteiro-chip est-" + est.cls} onClick={() => setAberto((v) => !v)} title={`Roteiro do dia — ${chip.dica}`}>
        <span className="roteiro-chip-icone">{est.icone}</span>
        <span className="roteiro-chip-texto">
          <b>{chip.titulo}</b>
          <span>{chip.tempo ? <span className="mono">{chip.tempo}</span> : null}{chip.tempo ? " " : ""}{chip.dica}</span>
        </span>
        {totalBadge > 0 && <span className="notif-count">{totalBadge}</span>}
        {progressoAtual != null && <span className="roteiro-chip-prog" style={{ width: `${Math.round(Math.min(1, progressoAtual) * 100)}%` }} />}
      </button>
      {aberto && <PainelPessoal r={r} t={t} cfg={cfg} currentUser={currentUser} navigate={navigate} ciInfo={ciInfo} onFechar={() => setAberto(false)} />}
    </div>
  );
}

