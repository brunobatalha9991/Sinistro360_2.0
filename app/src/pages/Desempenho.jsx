import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/EmptyState.jsx";
import { Avatar } from "../components/Avatar.jsx";
import { calcularMetricasTodosUsuarios, gerarFeedbackEPlanoDeAcao } from "../logic/desempenho";
import { patchListFilter, resetListFilter } from "../state/listFilter";
import { fmtNum } from "../logic/format";
import { isDriveUploadConfigured, uploadArquivoDrive, sanitizarNomePasta, CONTEXTO_PERFIL_USUARIO } from "../logic/driveUpload";
import { isAdmin, ROLE_LABELS } from "../data/auth";
import { isGeminiConfigured } from "../ai/geminiApi";
import { gerarFeedbackEmTextoCorrido } from "../ai/gerarFeedbackTexto";
import { metricasAgenda, temAgendaPropria, agendaCfg, fmtPct } from "../logic/agenda";
import { IndicadoresAgendaGrid } from "../components/agenda/IndicadoresPanel.jsx";
import { ehOperacional, metricasConduta, comConduta } from "../logic/conduta";
import { CondutaPerfilCard, NovoRegistroModal } from "../components/desempenho/CondutaPanel.jsx";
import { todasCIsNormalizadas, metricasCIUsuario, comCI } from "../logic/desempenhoCI";
import { CIDesempenhoCard } from "../components/desempenho/CIDesempenhoCard.jsx";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function fmtDiasMedia(n) { return n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " d"; }

function Stat({ label, value, danger }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: danger ? "var(--danger)" : undefined }}>{value}</div>
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {desc && <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 12 }}>{desc}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

// Perfil individual do usuário (drill-down do painel de Desempenho) — a
// pedido do usuário: foto, todos os indicadores calculados e atalhos pra
// lista de sinistros já filtrada. Reaproveita o mesmo upload de anexos pro
// Drive (logic/driveUpload.js), numa pasta-contexto própria (uma subpasta
// por usuário, pelo nome).
function PerfilUsuario({ m, u, users, config, saveRecord, currentUser, isAdminUser, navigate, periodoLabel, analise, agenda, conduta, ci, onNovoRegistro }) {
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState(null);
  const uploadOk = isDriveUploadConfigured(config);
  const podeEditarFoto = isAdminUser || (currentUser && currentUser.id === u.id);
  const iaOk = isGeminiConfigured();
  const [textoIa, setTextoIa] = useState(null);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [erroIa, setErroIa] = useState(null);
  // Texto gerado fica desatualizado se o usuário trocar o período — some
  // pra não mostrar uma prosa sobre números que já não são os de cima.
  useEffect(() => { setTextoIa(null); setErroIa(null); }, [periodoLabel]);

  async function gerarTextoIa() {
    setGerandoIa(true); setErroIa(null);
    try {
      setTextoIa(await gerarFeedbackEmTextoCorrido({ nomeUsuario: u.nome, periodoLabel, analise }));
    } catch (e) {
      setErroIa(e.message);
    } finally {
      setGerandoIa(false);
    }
  }

  async function handleFoto(file) {
    if (!file) return;
    setEnviandoFoto(true); setErroFoto(null);
    try {
      const endpoint = config.corp_drive_upload_endpoint || "";
      const enviado = await uploadArquivoDrive({ endpoint, file, pasta: sanitizarNomePasta(u.nome), contexto: CONTEXTO_PERFIL_USUARIO });
      saveRecord("corp_users", (current) => (current || []).map((x) => (x.id === u.id ? { ...x, fotoUrl: enviado.url } : x)));
    } catch (e) {
      setErroFoto(e.message);
    } finally {
      setEnviandoFoto(false);
    }
  }

  function verSinistros(extra) {
    resetListFilter();
    patchListFilter({ responsavel: u.id, aberto: true, showFilters: true, ...extra });
    navigate("sinistros");
  }

  return (
    <div className="page-enter">
      <div className="card">
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar url={m.usuarioFoto} nome={u.nome} size={72} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}>{u.nome}</h2>
              <span className={"badge " + (u.role === "admin" ? "purple" : u.role === "consulta" ? "gray" : "blue")}>{ROLE_LABELS[u.role]}</span>
              {u.vip && <span className="badge amber">★ VIP</span>}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{u.email}</div>
          </div>
          {isAdminUser && <button className="btn ghost xs" onClick={() => navigate("desempenho")}>← Voltar</button>}
        </div>

        {podeEditarFoto && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            {!uploadOk ? (
              <p className="muted" style={{ fontSize: 12 }}>Configure o upload de anexos em Configurações para habilitar o envio de foto.</p>
            ) : (
              <>
                <label className="btn sec xs" style={{ cursor: enviandoFoto ? "default" : "pointer" }}>
                  {enviandoFoto ? "Enviando..." : "Alterar foto"}
                  <input type="file" accept="image/*" style={{ display: "none" }} disabled={enviandoFoto}
                    onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; handleFoto(f); }} />
                </label>
                {erroFoto && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erroFoto}</div>}
              </>
            )}
          </div>
        )}
      </div>

      {m.processosSemHistoricoEstruturado > 0 && (
        <div className="card">
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            ⚠ {m.processosSemHistoricoEstruturado} processo(s) no estoque atual deste usuário ainda sem histórico de responsabilidade estruturado — "Tempo médio de responsabilidade" e "Assumidos no período" ficam incompletos para eles. Gere a estimativa em Configurações.
          </p>
        </div>
      )}

      <div className="grid c2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Feedback ({periodoLabel})</h3>
          <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 12 }}>
            {analise.comparavel ? "Gerado automaticamente comparando com a média do time no período." : "Time com 1 usuário só — sem base de comparação, usando regras absolutas."}
          </p>
          {!analise.pontosFortes.length && !analise.pontosAtencao.length ? (
            <p className="muted" style={{ fontSize: 13 }}>Sem diferenças relevantes em relação à média do time neste período.</p>
          ) : (
            <>
              {analise.pontosFortes.length > 0 && (
                <div style={{ marginBottom: analise.pontosAtencao.length ? 12 : 0 }}>
                  <b style={{ fontSize: 12, color: "var(--ok, #16a34a)" }}>✓ Pontos fortes</b>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                    {analise.pontosFortes.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              {analise.pontosAtencao.length > 0 && (
                <div>
                  <b style={{ fontSize: 12, color: "var(--danger)" }}>⚠ Pontos de atenção</b>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                    {analise.pontosAtencao.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
          {iaOk && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <button className="btn sec xs" disabled={gerandoIa} onClick={gerarTextoIa}>
                {gerandoIa ? "Gerando..." : textoIa ? "🪄 Gerar de novo" : "🪄 Gerar versão em texto corrido (IA)"}
              </button>
              {erroIa && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erroIa}</div>}
              {textoIa && <p style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-wrap" }}>{textoIa}</p>}
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Plano de ação</h3>
          <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 12 }}>Gerado automaticamente a partir do estoque atual — sem SLA formal configurado.</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            {analise.planoDeAcao.map((item, i) => (
              <li key={i}>
                {item.texto}
                {item.filtro && (
                  <button className="btn ghost xs" style={{ marginLeft: 8 }} onClick={() => verSinistros(item.filtro)}>Ver sinistros</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Section title="Estoque atual" desc="Processos sob responsabilidade deste usuário agora, independente do período selecionado.">
        <Stat label="Estoque atual" value={fmtNum(m.estoqueAtual)} />
        <Stat label="Pendentes" value={fmtNum(m.pendentesAtual)} />
        <Stat label="Em andamento" value={fmtNum(m.emAndamentoAtual)} />
        <Stat label="Atrasados" value={fmtNum(m.atrasadosAtual)} danger={m.atrasadosAtual > 0} />
        <Stat label="Sem atualização" value={fmtNum(m.semAtualizacaoAtual)} danger={m.semAtualizacaoAtual > 0} />
        <Stat label="Média de dias sem atualização" value={fmtDiasMedia(m.mediaDiasSemAtualizacao)} />
        <Stat label="Pesquisas de satisfação completas" value={fmtNum(m.pesquisasSatisfacaoCompletas)} />
      </Section>

      <Section title={`Atividade no período (${periodoLabel})`} desc="Só conta o que aconteceu enquanto este usuário era o responsável vigente no instante exato do evento — regra de justiça.">
        <Stat label="Assumidos no período" value={fmtNum(m.processosAssumidosNoPeriodo)} />
        <Stat label="Sob responsabilidade no período" value={fmtNum(m.processosSobResponsabilidadeNoPeriodo)} />
        <Stat label="Tempo médio de responsabilidade" value={fmtDiasMedia(m.tempoMedioResponsabilidadeDias)} />
        <Stat label="Tempo médio em Pendente" value={fmtDiasMedia(m.tempoMedioPendenteDias)} />
        <Stat label="Tempo médio em Em andamento" value={fmtDiasMedia(m.tempoMedioAndamentoDias)} />
        <Stat label="Históricos registrados" value={fmtNum(m.historicosRegistrados)} />
        <Stat label="Aguardando retorno" value={fmtNum(m.aguardandoRetornoQtd)} />
        <Stat label="Limitação de comunicação" value={fmtNum(m.limitacaoComunicacaoQtd)} />
        <Stat label="Avaliação média (histórico)" value={m.avaliacaoMediaHistorico == null ? "—" : m.avaliacaoMediaHistorico.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
        <Stat label="Próximas ações registradas" value={fmtNum(m.proximasAcoesRegistradas)} />
      </Section>
      {(m.processosTransicaoAproximada > 0 || m.processosTransicaoIndisponivel > 0) && (
        <div className="card">
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {m.processosTransicaoAproximada > 0 && <>⚠ {m.processosTransicaoAproximada} processo(s) usam uma data aproximada de início de "Em andamento" (caminho por ramo escolhido antes de o sistema passar a registrar esse instante exato). </>}
            {m.processosTransicaoIndisponivel > 0 && <>⚠ {m.processosTransicaoIndisponivel} processo(s) ficaram de fora de "Tempo médio em Pendente/Em andamento" por falta de qualquer data de referência.</>}
          </p>
        </div>
      )}

      <Section title={`Desfechos no período (${periodoLabel})`} desc="Data do desfecho = conclusão da última etapa efetiva do processo.">
        <Stat label="Finalizados no período" value={fmtNum(m.finalizadosNoPeriodo)} />
        <Stat label="Indenizados" value={fmtNum(m.indenizadosNoPeriodo)} />
        <Stat label="Constatação" value={fmtNum(m.constatacoesNoPeriodo)} />
        <Stat label="Sem indenização" value={fmtNum(m.semIndenizacaoNoPeriodo)} />
      </Section>

      <CIDesempenhoCard m={ci} periodoLabel={periodoLabel} onVerCIs={() => navigate("tarefas")} />

      <CondutaPerfilCard mc={conduta} users={users} periodoLabel={periodoLabel} isAdminUser={isAdminUser} onNovo={onNovoRegistro} />

      {agenda && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Agenda ({periodoLabel})</h3>
          <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 12 }}>
            Cumprimento do planejamento do dia (módulo Agenda): ações iniciadas e finalizadas com feedback, no horário.
          </p>
          <IndicadoresAgendaGrid m={agenda} cfg={agendaCfg(config)} />
          <button className="btn ghost xs" style={{ marginTop: 10 }} onClick={() => navigate("agenda")}>Abrir Agenda</button>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Ver sinistros</h3>
        <div className="chips">
          <div className="chip-btn" onClick={() => verSinistros({})}>Estoque atual ({m.estoqueAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ atrasado: true })}>Atrasados ({m.atrasadosAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ semAtu: true })}>Sem atualização ({m.semAtualizacaoAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ status: "Pendente" })}>Pendentes ({m.pendentesAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ status: "Em andamento" })}>Em andamento ({m.emAndamentoAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ aberto: false, status: "Indenizado" })}>Indenizados ({m.indenizadosNoPeriodo})</div>
          <div className="chip-btn" onClick={() => verSinistros({ aberto: false, status: "Constatação" })}>Constatação ({m.constatacoesNoPeriodo})</div>
          <div className="chip-btn" onClick={() => verSinistros({ aberto: false, status: "Encerrado sem Indenização" })}>Sem indenização ({m.semIndenizacaoNoPeriodo})</div>
        </div>
      </div>
    </div>
  );
}

// Soma a Agenda ao feedback automático do perfil: abaixo de 70% de
// cumprimento ou com ações sem registro vira ponto de atenção; 90% ou
// mais vira ponto forte. Sem nenhuma ação vencida no período, não opina.
function comAgenda(analise, ag) {
  if (!ag || ag.taxaCumprimento == null) return analise;
  const fortes = analise.pontosFortes.slice();
  const atencao = analise.pontosAtencao.slice();
  const pct = fmtPct(ag.taxaCumprimento);
  if (ag.taxaCumprimento >= 0.9) fortes.push(`Cumpre a agenda planejada (${pct} das ações concluídas no período).`);
  else if (ag.taxaCumprimento < 0.7) atencao.push(`Cumprimento da agenda baixo: ${pct} das ações concluídas (${ag.concluidas} de ${ag.vencidas}).`);
  if (ag.semRegistro > 0) atencao.push(`${ag.semRegistro} ação(ões) da agenda passaram do horário sem nenhum registro.`);
  if (ag.pontualidade != null && ag.pontualidade < 0.7) atencao.push(`Pontualidade no início das ações da agenda: ${fmtPct(ag.pontualidade)}.`);
  return { ...analise, pontosFortes: fortes, pontosAtencao: atencao };
}

// Fase 5 (IA Sinistros) — painel de Desempenho, ampliado numa "v2" a
// pedido do usuário (gestão de equipe: Atendentes/Analistas): foto, filtro
// por usuário e perfil individual com todos os indicadores. Ver
// docs/ia-sinistros/metricas-desempenho.md.
export function Desempenho() {
  const { records, config, saveRecord } = useData();
  const { param, navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const [periodoDe, setPeriodoDe] = useState(diasAtras(30));
  const [periodoAte, setPeriodoAte] = useState(todayISO());
  const [filtroUsuarioId, setFiltroUsuarioId] = useState("todos");
  const [novoRegistroPara, setNovoRegistroPara] = useState(null); // null = fechado; [] = sem pré-seleção

  // Só a equipe operacional (Atendente/Analista) aparece no Desempenho — a
  // pedido do usuário. Admin/VIP veem todos; os demais, só o próprio.
  const usersRaw = records.corp_users;
  const todosUsuarios = usersRaw || [];
  const users = useMemo(() => (usersRaw || []).filter(ehOperacional), [usersRaw]);
  const claims = records.corp_claims || [];
  const overrides = records.corp_overrides || {};
  const historico = records.corp_responsabilidade_historico || [];
  const tasks = records.corp_tasks || [];
  const templates = config.corp_journey_templates;

  const inicioISO = periodoDe ? periodoDe + "T00:00:00.000Z" : null;
  const fimISO = periodoAte ? periodoAte + "T23:59:59.999Z" : null;
  const periodoLabel = periodoDe && periodoAte ? `${periodoDe} a ${periodoAte}` : "todo o histórico";

  const atendTemplateCfg = config.corp_atendimento_template;
  const metricas = useMemo(
    () => calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO: inicioISO, periodoFimISO: fimISO, atendTemplateCfg, templates, tasks }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, claims, overrides, historico, inicioISO, fimISO, atendTemplateCfg, templates, tasks]
  );

  // Indicadores da Agenda por usuário (só Atendente/Analista têm agenda).
  const blocosAgenda = records.corp_agenda;
  const feedbacksAgenda = records.corp_agenda_feedback;
  const agendaPorUsuario = useMemo(() => {
    const cfg = agendaCfg(config);
    const out = {};
    users.filter(temAgendaPropria).forEach((u) => {
      out[u.id] = metricasAgenda({ blocos: blocosAgenda || [], feedbacks: feedbacksAgenda || [], userId: u.id, deISO: periodoDe || null, ateISO: periodoAte || null, cfg });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, blocosAgenda, feedbacksAgenda, periodoDe, periodoAte, config.corp_agenda_cfg]);

  function verSinistrosDoUsuario(usuarioId) {
    resetListFilter();
    patchListFilter({ responsavel: usuarioId, aberto: true, showFilters: true });
    navigate("sinistros");
  }

  const isAdminUser = isAdmin(currentUser);

  const condutaRegistros = records.corp_conduta;
  const condutaPorUsuario = useMemo(() => {
    const out = {};
    users.forEach((u) => { out[u.id] = metricasConduta({ registros: condutaRegistros || [], userId: u.id, deISO: periodoDe || null, ateISO: periodoAte || null }); });
    return out;
  }, [users, condutaRegistros, periodoDe, periodoAte]);

  // Atuação na Comunicação Interna (CIs vivas + histórico das já apagadas).
  const tasksRaw = records.corp_tasks;
  const ciHistorico = records.corp_ci_historico;
  const notifsRaw = records.corp_notifs;
  const ciPorUsuario = useMemo(() => {
    const cis = todasCIsNormalizadas(tasksRaw, ciHistorico);
    const out = {};
    users.forEach((u) => { out[u.id] = metricasCIUsuario({ cis, notifs: notifsRaw, userId: u.id, deISO: periodoDe || null, ateISO: periodoAte || null, config }); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, tasksRaw, ciHistorico, notifsRaw, periodoDe, periodoAte, config.corp_ci_sem_interacao]);

  const modalRegistro = isAdminUser && novoRegistroPara && (
    <NovoRegistroModal operacionais={users} preSelecionados={novoRegistroPara} autor={currentUser} onClose={() => setNovoRegistroPara(null)} />
  );

  // Quem não é Admin/VIP só enxerga o próprio perfil, qualquer que seja a URL.
  const perfilId = isAdminUser ? param : currentUser && currentUser.id;

  // Perfil individual — quando há um usuarioId na URL (#/desempenho/usr_x).
  if (perfilId) {
    const u = users.find((x) => x.id === perfilId);
    const m = metricas.find((x) => x.usuarioId === perfilId);
    if (!u || !m) {
      return <div className="page-enter"><EmptyState>{isAdminUser ? "Usuário não encontrado." : "O Desempenho mostra os indicadores da equipe operacional (Atendentes e Analistas)."}</EmptyState></div>;
    }
    return (
      <div className="page-enter">
        <div className="page-head">
          <div><h1>Desempenho — {u.nome}</h1></div>
        </div>
        <div className="card">
          <div className="chips" style={{ alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Período:</span>
            <span className="muted" style={{ fontSize: 12 }}>de</span>
            <input type="date" className="inline" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} />
            <span className="muted" style={{ fontSize: 12 }}>até</span>
            <input type="date" className="inline" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} />
            {[7, 30, 90].map((d) => (
              <div key={d} className="chip-btn" onClick={() => { setPeriodoDe(diasAtras(d)); setPeriodoAte(todayISO()); }}>{d} dias</div>
            ))}
            <div className="chip-btn" onClick={() => { setPeriodoDe(""); setPeriodoAte(""); }}>Todo o histórico</div>
          </div>
        </div>
        <PerfilUsuario
          key={u.id}
          m={m} u={u} users={todosUsuarios} config={config} saveRecord={saveRecord} currentUser={currentUser} isAdminUser={isAdminUser}
          navigate={navigate} periodoLabel={periodoLabel}
          analise={comCI(comConduta(comAgenda(gerarFeedbackEPlanoDeAcao(m, metricas), agendaPorUsuario[u.id]), condutaPorUsuario[u.id]), ciPorUsuario[u.id], fmtPct)}
          agenda={agendaPorUsuario[u.id]}
          conduta={condutaPorUsuario[u.id]}
          ci={ciPorUsuario[u.id]}
          onNovoRegistro={() => setNovoRegistroPara([u.id])}
        />
        {modalRegistro}
      </div>
    );
  }

  const metricasFiltradas = filtroUsuarioId === "todos" ? metricas : metricas.filter((m) => m.usuarioId === filtroUsuarioId);
  const totalSemHistorico = metricasFiltradas.reduce((s, m) => s + m.processosSemHistoricoEstruturado, 0);

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Desempenho</h1>
          <p>Métricas por usuário, baseadas no histórico de responsabilidade — respeita quem era responsável em cada período.</p>
        </div>
        <button className="btn" onClick={() => setNovoRegistroPara([])}>+ Novo registro</button>
      </div>

      <div className="card">
        <div className="chips" style={{ alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Período:</span>
          <span className="muted" style={{ fontSize: 12 }}>de</span>
          <input type="date" className="inline" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} />
          <span className="muted" style={{ fontSize: 12 }}>até</span>
          <input type="date" className="inline" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} />
          {[7, 30, 90].map((d) => (
            <div key={d} className="chip-btn" onClick={() => { setPeriodoDe(diasAtras(d)); setPeriodoAte(todayISO()); }}>{d} dias</div>
          ))}
          <div className="chip-btn" onClick={() => { setPeriodoDe(""); setPeriodoAte(""); }}>Todo o histórico</div>
        </div>
        {users.length > 1 && (
          <div className="chips" style={{ alignItems: "center", marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Usuário:</span>
            <div className={"chip-btn" + (filtroUsuarioId === "todos" ? " active" : "")} onClick={() => setFiltroUsuarioId("todos")}>Todos</div>
            {users.map((u) => (
              <div key={u.id} className={"chip-btn" + (filtroUsuarioId === u.id ? " active" : "")} onClick={() => setFiltroUsuarioId(u.id)}>{u.nome}</div>
            ))}
          </div>
        )}
        {totalSemHistorico > 0 && (
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            ⚠ {totalSemHistorico} processo(s) no estoque atual ainda sem histórico de responsabilidade estruturado — os números de "Estoque atual"/"Atrasados" continuam corretos (usam o responsável atual direto), mas "Tempo médio" e "Assumidos no período" ficam incompletos para eles. Gere a estimativa em Configurações.
          </p>
        )}
      </div>

      {!metricasFiltradas.length ? <div className="card"><EmptyState>Nenhum usuário cadastrado.</EmptyState></div> : (
        <div className="card">
          <div style={{ overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Usuário</th>
                  <th className="right">Estoque atual</th>
                  <th className="right">Atrasados</th>
                  <th className="right">Finalizados no período</th>
                  <th className="right">Tempo médio de responsabilidade</th>
                  <th className="right" title="Ações da agenda concluídas ÷ ações cujo horário já terminou, no período">Agenda (cumprimento)</th>
                  <th className="right" title="CIs recebidas no período com a primeira interação dentro do prazo (10 min; 5 se Urgente)">CI 1ª interação no prazo</th>
                  <th className="right" title="Registros negativos (advertência, falha, apontamento, ausência, reclamação, ocorrência) no período • registros ainda sem ciente">Conduta</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {metricasFiltradas.map((m) => (
                  <tr key={m.usuarioId}>
                    <td><Avatar url={m.usuarioFoto} nome={m.usuarioNome} size={30} /></td>
                    <td>{m.usuarioNome}</td>
                    <td className="mono right">{fmtNum(m.estoqueAtual)}</td>
                    <td className="mono right">{m.atrasadosAtual > 0 ? <span className="badge red">{m.atrasadosAtual}</span> : "0"}</td>
                    <td className="mono right">{fmtNum(m.finalizadosNoPeriodo)}</td>
                    <td className="mono right">{fmtDiasMedia(m.tempoMedioResponsabilidadeDias)}</td>
                    <td className="mono right">
                      {agendaPorUsuario[m.usuarioId]
                        ? <span className={agendaPorUsuario[m.usuarioId].taxaCumprimento != null && agendaPorUsuario[m.usuarioId].taxaCumprimento < 0.7 ? "badge red" : undefined}>{fmtPct(agendaPorUsuario[m.usuarioId].taxaCumprimento)}</span>
                        : "—"}
                    </td>
                    <td className="mono right">
                      {(() => {
                        const c = ciPorUsuario[m.usuarioId];
                        if (!c || !c.recebidas) return "—";
                        return <span className={c.pctNoPrazo != null && c.pctNoPrazo < 0.7 ? "badge red" : undefined} title={`${c.recebidas} recebida(s) • ${c.foraPrazo} em atraso`}>{fmtPct(c.pctNoPrazo)}</span>;
                      })()}
                    </td>
                    <td className="mono right">
                      {(() => {
                        const c = condutaPorUsuario[m.usuarioId];
                        if (!c || !c.total) return "—";
                        return <>
                          <span className={c.negativos ? "badge red" : undefined} title="Registros negativos">{c.negativos}</span>
                          {c.pendentesCiente > 0 && <span className="badge orange" style={{ marginLeft: 4 }} title="Sem ciente">{c.pendentesCiente} pend.</span>}
                        </>;
                      })()}
                    </td>
                    <td>
                      <button className="btn sec xs" style={{ marginRight: 6 }} onClick={() => navigate("desempenho", m.usuarioId)}>Ver perfil</button>
                      <button className="btn ghost xs" onClick={() => verSinistrosDoUsuario(m.usuarioId)}>Ver sinistros</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            "Estoque atual" e "Atrasados" usam o responsável vigente agora, independente do período selecionado. Abra "Ver perfil" para o detalhamento completo (histórico, próximas ações, desfechos, tarefas e mais).
          </p>
        </div>
      )}
      {modalRegistro}
    </div>
  );
}
