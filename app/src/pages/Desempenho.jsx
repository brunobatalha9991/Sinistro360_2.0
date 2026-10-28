import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/EmptyState.jsx";
import { calcularMetricasTodosUsuarios, calcularMetricasUsuario, gerarFeedbackEPlanoDeAcao } from "../logic/desempenho";
import { patchListFilter, resetListFilter } from "../state/listFilter";
import { fmtNum } from "../logic/format";
import { isDriveUploadConfigured, uploadArquivoDrive, sanitizarNomePasta, CONTEXTO_PERFIL_USUARIO } from "../logic/driveUpload";
import { isAdmin } from "../data/auth";
import { isGeminiConfigured } from "../ai/geminiApi";
import { gerarFeedbackEmTextoCorrido } from "../ai/gerarFeedbackTexto";
import { metricasAgenda, temAgendaPropria, agendaCfg, fmtPct, minToHHMM } from "../logic/agenda";
import { IndicadoresAgendaGrid } from "../components/agenda/IndicadoresPanel.jsx";
import { ehOperacional, metricasConduta, comConduta } from "../logic/conduta";
import { CondutaPerfilCard, NovoRegistroModal } from "../components/desempenho/CondutaPanel.jsx";
import { todasCIsNormalizadas, metricasCIUsuario, comCI } from "../logic/desempenhoCI";
import { CIDesempenhoCard } from "../components/desempenho/CIDesempenhoCard.jsx";
import { semInteracaoCfg } from "../logic/ciAutomacao";
import { resumoRoteiro } from "../logic/roteiroDia";
import { intervencoesPendentes } from "../logic/tasks";
import { metricasExtras, assiduidade, calcularIndice, filaDoDia, semanasRecentes, pesosDesempenho } from "../logic/desempenhoPainel";
import { HeroOperador, HojeGrid, FilaDoDiaCard, PilaresCard, TendenciaCard } from "../components/desempenho/PainelVisual.jsx";
import { EquipeView } from "../components/desempenho/EquipeView.jsx";
import { ImpactoCard, RitmoOperadorCard, RitmoEquipe } from "../components/desempenho/RitmoDia.jsx";
import { impactoPendencias } from "../logic/desempenhoRitmo";

// Desempenho v3 (a pedido do usuário: "visualização de alto impacto",
// refeito por inteiro). Duas telas:
//   - Painel do operador (o próprio, ou qualquer um para Admin/VIP): topo
//     com o Índice de Desempenho, "Hoje" (agenda, próximas ações, CIs,
//     carteira), fila priorizada do dia, pilares do índice, evolução de 8
//     semanas, feedback/plano de ação e o detalhamento completo em abas.
//   - Equipe (Admin/VIP): placar, ranking, alertas e mapa de calor.
// Toda a matemática fica em logic/desempenhoPainel.js (+ as métricas já
// existentes em desempenho.js, desempenhoCI.js, agenda.js e conduta.js).

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtDiasMedia(n) { return n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " d"; }
function fmtBR(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : ""; }

function Stat({ label, value, danger, title }) {
  return (
    <div className="stat-box" title={title}>
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

function PeriodoChips({ periodoDe, periodoAte, setPeriodoDe, setPeriodoAte }) {
  const ativo = (d) => periodoDe === diasAtras(d) && periodoAte === todayISO();
  return (
    <div className="periodo-barra">
      <span className="muted" style={{ fontSize: 12 }}>Período</span>
      {[7, 30, 90].map((d) => (
        <div key={d} className={"chip-btn" + (ativo(d) ? " active" : "")} onClick={() => { setPeriodoDe(diasAtras(d)); setPeriodoAte(todayISO()); }}>{d} dias</div>
      ))}
      <div className={"chip-btn" + (!periodoDe && !periodoAte ? " active" : "")} onClick={() => { setPeriodoDe(""); setPeriodoAte(""); }}>Tudo</div>
      <input type="date" className="inline" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} aria-label="De" />
      <span className="muted" style={{ fontSize: 12 }}>até</span>
      <input type="date" className="inline" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} aria-label="Até" />
    </div>
  );
}

// Soma a Agenda ao feedback automático do perfil.
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
// Soma as métricas novas (carteira, assiduidade, reclamações...) ao feedback.
function comExtras(analise, ex, as) {
  const fortes = analise.pontosFortes.slice();
  const atencao = analise.pontosAtencao.slice();
  if (ex.proximaVencida) atencao.push(`${ex.proximaVencida} processo(s) com próxima ação vencida — priorize hoje.`);
  if (ex.semProximaAcao) atencao.push(`${ex.semProximaAcao} processo(s) da carteira sem próxima ação definida.`);
  if (ex.etapasForaPrazo) atencao.push(`${ex.etapasForaPrazo} processo(s) com etapa da jornada fora do prazo.`);
  if (ex.renovacoes >= 5 && ex.renovacoes > ex.historicos / 2) atencao.push(`Usou "Dentro do prazo" ${ex.renovacoes} vez(es) — mais da metade dos históricos registrados.`);
  if (ex.reclamacoes) atencao.push(`${ex.reclamacoes} reclamação(ões) registrada(s) em processos sob sua responsabilidade.`);
  if (ex.notaCorretoraMedia != null && ex.notaCorretoraMedia >= 4.5) fortes.push(`Clientes avaliam bem a corretora nos seus processos (nota média ${ex.notaCorretoraMedia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}).`);
  if (ex.estoque && !ex.proximaVencida && !ex.semProximaAcao) fortes.push("Carteira 100% com próxima ação definida e nenhuma vencida.");
  if (as && as.pctNoHorario != null && as.pctNoHorario < 0.7) atencao.push(`Chegou no horário em só ${fmtPct(as.pctNoHorario)} dos dias.`);
  if (as && as.faltas > 0) atencao.push(`${as.faltas} dia(s) útil(eis) sem acesso ao sistema.`);
  return { ...analise, pontosFortes: fortes, pontosAtencao: atencao };
}

function FeedbackCard({ analise, u, periodoLabel, verSinistros }) {
  const iaOk = isGeminiConfigured();
  const [textoIa, setTextoIa] = useState(null);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [erroIa, setErroIa] = useState(null);
  async function gerarTextoIa() {
    setGerandoIa(true); setErroIa(null);
    try { setTextoIa(await gerarFeedbackEmTextoCorrido({ nomeUsuario: u.nome, periodoLabel, analise })); }
    catch (e) { setErroIa(e.message); }
    finally { setGerandoIa(false); }
  }
  return (
    <div className="card">
      <div className="secao-topo"><h3>💡 Feedback e plano de ação</h3><span className="muted" style={{ fontSize: 12 }}>automático</span></div>
      {analise.pontosFortes.length > 0 && (
        <div className="fb-bloco fb-forte">
          <b>✓ Pontos fortes</b>
          <ul>{analise.pontosFortes.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      {analise.pontosAtencao.length > 0 && (
        <div className="fb-bloco fb-atencao">
          <b>⚠ Pontos de atenção</b>
          <ul>{analise.pontosAtencao.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      {!analise.pontosFortes.length && !analise.pontosAtencao.length && <p className="muted" style={{ fontSize: 13 }}>Sem diferenças relevantes neste período.</p>}
      {analise.planoDeAcao.length > 0 && (
        <div className="fb-bloco">
          <b>🎯 Plano de ação</b>
          <ul>
            {analise.planoDeAcao.map((item, i) => (
              <li key={i}>{item.texto}{item.filtro && <button className="btn ghost xs" style={{ marginLeft: 8 }} onClick={() => verSinistros(item.filtro)}>Ver sinistros</button>}</li>
            ))}
          </ul>
        </div>
      )}
      {iaOk && (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <button className="btn sec xs" disabled={gerandoIa} onClick={gerarTextoIa}>{gerandoIa ? "Gerando..." : textoIa ? "🪄 Gerar de novo" : "🪄 Gerar versão em texto corrido (IA)"}</button>
          {erroIa && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erroIa}</div>}
          {textoIa && <p style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-wrap" }}>{textoIa}</p>}
        </div>
      )}
    </div>
  );
}

function DetalheProcessos({ m, ex, as, periodoLabel, verSinistros }) {
  return (
    <>
      <Section title="Carteira agora" desc="Processos sob responsabilidade deste usuário agora, independente do período.">
        <Stat label="Processos na carteira" value={fmtNum(m.estoqueAtual)} />
        <Stat label="Pendentes" value={fmtNum(m.pendentesAtual)} />
        <Stat label="Em andamento" value={fmtNum(m.emAndamentoAtual)} />
        <Stat label="Próxima ação vencida" value={fmtNum(ex.proximaVencida)} danger={ex.proximaVencida > 0} />
        <Stat label="Próxima ação para hoje" value={fmtNum(ex.proximaHoje)} />
        <Stat label="Sem próxima ação" value={fmtNum(ex.semProximaAcao)} danger={ex.semProximaAcao > 0} />
        <Stat label="Sem atualização (3+ dias)" value={fmtNum(m.semAtualizacaoAtual)} danger={m.semAtualizacaoAtual > 0} />
        <Stat label="Média de dias sem atualização" value={fmtDiasMedia(m.mediaDiasSemAtualizacao)} />
        <Stat label="Com etapa fora do prazo" value={fmtNum(ex.etapasForaPrazo)} danger={ex.etapasForaPrazo > 0} />
        <Stat label="Com link de acompanhamento" value={`${ex.linkAtivo} (${fmtPct(ex.pctLinkAtivo)})`} title="Processos da carteira com link público de acompanhamento ativo para o cliente" />
        <Stat label="E-mails vinculados a tratar" value={fmtNum(ex.emailsPendentes)} danger={ex.emailsPendentes > 0} />
        <Stat label="Pesquisas de satisfação completas" value={fmtNum(m.pesquisasSatisfacaoCompletas)} />
      </Section>

      <Section title={`Atividade no período (${periodoLabel})`} desc="Só conta o que aconteceu enquanto este usuário era o responsável vigente no instante do evento — regra de justiça.">
        <Stat label="Históricos registrados" value={fmtNum(m.historicosRegistrados)} />
        <Stat label="Contato direto com o cliente" value={fmtPct(ex.pctContatoCliente)} title="% dos históricos registrados no canal Cliente" />
        <Stat label="Mensagens de WhatsApp (templates)" value={fmtNum(ex.whatsapp)} />
        <Stat label="Etapas da jornada concluídas" value={fmtNum(ex.etapasConcluidas)} />
        <Stat label="Próximas ações registradas" value={fmtNum(m.proximasAcoesRegistradas)} />
        <Stat label='Renovações "Dentro do prazo"' value={fmtNum(ex.renovacoes)} danger={ex.renovacoes >= 5 && ex.renovacoes > ex.historicos / 2} title="Renovações do prazo do histórico sem registrar atualização" />
        <Stat label="Aguardando retorno" value={fmtNum(m.aguardandoRetornoQtd)} />
        <Stat label="Limitação de comunicação" value={fmtNum(m.limitacaoComunicacaoQtd)} />
        <Stat label="Avaliação média (histórico)" value={m.avaliacaoMediaHistorico == null ? "—" : m.avaliacaoMediaHistorico.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
        <Stat label="Nota da corretora (pesquisa)" value={ex.notaCorretoraMedia == null ? "—" : `${ex.notaCorretoraMedia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} (${ex.pesquisasCorretora})`} />
        <Stat label="Reclamações nos processos" value={fmtNum(ex.reclamacoes)} danger={ex.reclamacoes > 0} />
        <Stat label="Processos recebidos / repassados" value={`${ex.recebidos} / ${ex.repassados}`} />
        <Stat label="Assumidos no período" value={fmtNum(m.processosAssumidosNoPeriodo)} />
        <Stat label="Tempo médio de responsabilidade" value={fmtDiasMedia(m.tempoMedioResponsabilidadeDias)} />
        <Stat label="Tempo médio em Pendente" value={fmtDiasMedia(m.tempoMedioPendenteDias)} />
        <Stat label="Tempo médio em Em andamento" value={fmtDiasMedia(m.tempoMedioAndamentoDias)} />
      </Section>

      <Section title={`Desfechos no período (${periodoLabel})`} desc="Data do desfecho = conclusão da última etapa efetiva do processo.">
        <Stat label="Finalizados" value={fmtNum(m.finalizadosNoPeriodo)} />
        <Stat label="Indenizados" value={fmtNum(m.indenizadosNoPeriodo)} />
        <Stat label="Constatação" value={fmtNum(m.constatacoesNoPeriodo)} />
        <Stat label="Sem indenização" value={fmtNum(m.semIndenizacaoNoPeriodo)} />
      </Section>

      {as && (
        <Section title="Assiduidade" desc={`Dias úteis no período (até 30 dias, desde que o sistema registra acessos). No horário = primeiro acesso até ${minToHHMM(as.limiteMin || 0)}.`}>
          <Stat label="Dias úteis considerados" value={fmtNum(as.diasUteis)} />
          <Stat label="Dias com acesso" value={fmtNum(as.diasComAcesso)} />
          <Stat label="Dias sem acesso" value={fmtNum(as.faltas)} danger={as.faltas > 0} />
          <Stat label="Chegada no horário" value={fmtPct(as.pctNoHorario)} danger={as.pctNoHorario != null && as.pctNoHorario < 0.7} />
          <Stat label="Horário médio de chegada" value={as.chegadaMediaMin == null ? "—" : minToHHMM(Math.round(as.chegadaMediaMin))} />
        </Section>
      )}

      {(m.processosTransicaoAproximada > 0 || m.processosTransicaoIndisponivel > 0 || m.processosSemHistoricoEstruturado > 0) && (
        <div className="card">
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {m.processosSemHistoricoEstruturado > 0 && <>⚠ {m.processosSemHistoricoEstruturado} processo(s) da carteira ainda sem histórico de responsabilidade estruturado (gere a estimativa em Configurações). </>}
            {m.processosTransicaoAproximada > 0 && <>⚠ {m.processosTransicaoAproximada} processo(s) usam data aproximada de início de "Em andamento". </>}
            {m.processosTransicaoIndisponivel > 0 && <>⚠ {m.processosTransicaoIndisponivel} processo(s) fora de "Tempo médio em Pendente/Em andamento" por falta de data.</>}
          </p>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Ver sinistros</h3>
        <div className="chips">
          <div className="chip-btn" onClick={() => verSinistros({})}>Carteira ({m.estoqueAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ atrasado: true })}>Próxima ação vencida ({m.atrasadosAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ pa: todayISO() })}>Próxima ação até hoje ({ex.proximaHoje + ex.proximaVencida})</div>
          <div className="chip-btn" onClick={() => verSinistros({ semAtu: true })}>Sem atualização ({m.semAtualizacaoAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ status: "Pendente" })}>Pendentes ({m.pendentesAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ status: "Em andamento" })}>Em andamento ({m.emAndamentoAtual})</div>
          <div className="chip-btn" onClick={() => verSinistros({ aberto: false, status: "Indenizado" })}>Indenizados ({m.indenizadosNoPeriodo})</div>
        </div>
      </div>
    </>
  );
}

function FotoUpload({ u, config, saveRecord }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  if (!isDriveUploadConfigured(config)) return null;
  async function handleFoto(file) {
    if (!file) return;
    setEnviando(true); setErro(null);
    try {
      const enviado = await uploadArquivoDrive({ endpoint: config.corp_drive_upload_endpoint || "", file, pasta: sanitizarNomePasta(u.nome), contexto: CONTEXTO_PERFIL_USUARIO });
      saveRecord("corp_users", (current) => (current || []).map((x) => (x.id === u.id ? { ...x, fotoUrl: enviado.url } : x)));
    } catch (e) { setErro(e.message); } finally { setEnviando(false); }
  }
  return (
    <>
      <label className="btn sec xs" style={{ cursor: enviando ? "default" : "pointer" }}>
        {enviando ? "Enviando..." : "📷 Foto"}
        <input type="file" accept="image/*" style={{ display: "none" }} disabled={enviando} onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; handleFoto(f); }} />
      </label>
      {erro && <span style={{ color: "var(--danger)", fontSize: 12 }}>{erro}</span>}
    </>
  );
}

const ABAS = [["processos", "📂 Processos"], ["ci", "📨 Comunicação Interna"], ["agenda", "🗓 Agenda"], ["conduta", "🛡 Conduta"]];

export function Desempenho() {
  const { records, config, saveRecord } = useData();
  const { param, navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const [periodoDe, setPeriodoDe] = useState(diasAtras(30));
  const [periodoAte, setPeriodoAte] = useState(todayISO());
  const [novoRegistroPara, setNovoRegistroPara] = useState(null); // null = fechado; [] = sem pré-seleção
  const [aba, setAba] = useState("processos");
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 1000); return () => clearInterval(id); }, []);
  const minuto = Math.floor(t / 60000);

  // Só a equipe operacional (Atendente/Analista) aparece no Desempenho.
  // Admin/VIP veem todos; os demais, só o próprio painel.
  const usersRaw = records.corp_users;
  const todosUsuarios = usersRaw || [];
  const users = useMemo(() => (usersRaw || []).filter(ehOperacional), [usersRaw]);
  const claims = records.corp_claims || [];
  const overrides = records.corp_overrides || {};
  const historico = records.corp_responsabilidade_historico || [];
  const tasks = records.corp_tasks || [];
  const templates = config.corp_journey_templates;
  const atendTemplateCfg = config.corp_atendimento_template;
  const isAdminUser = isAdmin(currentUser);
  const pesos = pesosDesempenho(config);

  const inicioISO = periodoDe ? periodoDe + "T00:00:00.000Z" : null;
  const fimISO = periodoAte ? periodoAte + "T23:59:59.999Z" : null;
  const periodoLabel = periodoDe && periodoAte ? `${fmtBR(periodoDe)} a ${fmtBR(periodoAte)}` : "todo o histórico";

  const metricas = useMemo(
    () => calcularMetricasTodosUsuarios({ users, claims, overrides, historico, periodoInicioISO: inicioISO, periodoFimISO: fimISO, atendTemplateCfg, templates, tasks }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, claims, overrides, historico, inicioISO, fimISO, atendTemplateCfg, templates, tasks]
  );

  const blocosAgenda = records.corp_agenda;
  const feedbacksAgenda = records.corp_agenda_feedback;
  const cfgAgenda = agendaCfg(config);
  const agendaPorUsuario = useMemo(() => {
    const out = {};
    users.filter(temAgendaPropria).forEach((u) => {
      out[u.id] = metricasAgenda({ blocos: blocosAgenda || [], feedbacks: feedbacksAgenda || [], userId: u.id, deISO: periodoDe || null, ateISO: periodoAte || null, cfg: cfgAgenda });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, blocosAgenda, feedbacksAgenda, periodoDe, periodoAte, config.corp_agenda_cfg]);

  const condutaRegistros = records.corp_conduta;
  const condutaPorUsuario = useMemo(() => {
    const out = {};
    users.forEach((u) => { out[u.id] = metricasConduta({ registros: condutaRegistros || [], userId: u.id, deISO: periodoDe || null, ateISO: periodoAte || null }); });
    return out;
  }, [users, condutaRegistros, periodoDe, periodoAte]);

  // Comunicação Interna (CIs vivas + histórico das já apagadas).
  const tasksRaw = records.corp_tasks;
  const ciHistorico = records.corp_ci_historico;
  const notifsRaw = records.corp_notifs;
  const cis = useMemo(() => todasCIsNormalizadas(tasksRaw, ciHistorico), [tasksRaw, ciHistorico]);
  const ciPorUsuario = useMemo(() => {
    const out = {};
    users.forEach((u) => { out[u.id] = metricasCIUsuario({ cis, notifs: notifsRaw, userId: u.id, deISO: periodoDe || null, ateISO: periodoAte || null, config }); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, cis, notifsRaw, periodoDe, periodoAte, config.corp_ci_sem_interacao]);

  // Métricas novas de carteira/atividade e assiduidade.
  const ocOf = records.corp_oficina_ocorrencias;
  const ocSeg = records.corp_seguradora_ocorrencias;
  const ocCli = records.corp_cliente_ocorrencias;
  const extrasPorUsuario = useMemo(() => {
    const ocorrencias = [...(ocOf || []), ...(ocSeg || []), ...(ocCli || [])];
    const out = {};
    users.forEach((u) => { out[u.id] = metricasExtras({ claims, overrides, historico, userId: u.id, deISO: periodoDe || null, ateISO: periodoAte || null, atendTemplateCfg, templates, ocorrencias }); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, claims, overrides, historico, periodoDe, periodoAte, atendTemplateCfg, templates, ocOf, ocSeg, ocCli]);
  const acessos = records.corp_acessos;
  const assidPorUsuario = useMemo(() => {
    const ci = semInteracaoCfg(config);
    const out = {};
    users.forEach((u) => { out[u.id] = assiduidade({ acessos, userId: u.id, deISO: periodoDe || null, ateISO: periodoAte || null, inicioExpediente: ci.horarioInicio || cfgAgenda.inicio || "08:30" }); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, acessos, periodoDe, periodoAte, config.corp_ci_sem_interacao, minuto]);

  const linhas = useMemo(() => users.map((u) => {
    const m = metricas.find((x) => x.usuarioId === u.id);
    const ex = extrasPorUsuario[u.id];
    const ci = ciPorUsuario[u.id];
    const agenda = agendaPorUsuario[u.id];
    const conduta = condutaPorUsuario[u.id];
    const as = assidPorUsuario[u.id];
    // Impacto das pendências de AGORA (independe do período escolhido).
    const impacto = impactoPendencias({ claims, overrides, tasks, blocos: blocosAgenda, feedbacks: feedbacksAgenda, user: u, atendTemplateCfg, templates, cfgCI: semInteracaoCfg(config), agora: new Date() });
    const indice = calcularIndice({ m, ex, ci, agenda, conduta, assid: as, pesos, impacto });
    const roteiro = temAgendaPropria(u) ? resumoRoteiro({ blocos: blocosAgenda, feedbacks: feedbacksAgenda, userId: u.id, agora: new Date(), cfg: cfgAgenda }) : null;
    return { u, m, ex, ci, agenda, conduta, as, indice, roteiro };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [users, metricas, extrasPorUsuario, ciPorUsuario, agendaPorUsuario, condutaPorUsuario, assidPorUsuario, config.corp_desempenho_pesos, blocosAgenda, feedbacksAgenda, minuto, claims, overrides, tasks, config.corp_ci_sem_interacao]);
  const comScore = linhas.filter((l) => l.indice.score != null);
  const mediaEquipe = comScore.length ? Math.round(comScore.reduce((s, l) => s + l.indice.score, 0) / comScore.length) : null;

  // Quem não é Admin/VIP só enxerga o próprio painel, qualquer que seja a URL.
  // "ritmo" (fechamento do dia no sino) abre o Ritmo do dia da equipe.
  const verRitmoParam = param === "ritmo";
  const [verRitmo, setVerRitmo] = useState(verRitmoParam);
  useEffect(() => { if (verRitmoParam) setVerRitmo(true); }, [verRitmoParam]);
  const perfilId = isAdminUser ? (verRitmoParam ? null : param) : currentUser && currentUser.id;
  const linha = perfilId ? linhas.find((l) => l.u.id === perfilId) : null;

  // Evolução semanal (só do painel aberto).
  const series = useMemo(() => {
    if (!linha) return null;
    const s = { historicos: [], finalizados: [], ciNoPrazo: [], agenda: [] };
    semanasRecentes(8).forEach((w) => {
      const mw = calcularMetricasUsuario({ claims, overrides, historico, usuarioId: perfilId, periodoInicioISO: w.de + "T00:00:00.000Z", periodoFimISO: w.ate + "T23:59:59.999Z", atendTemplateCfg, templates, tasks });
      const cw = metricasCIUsuario({ cis, notifs: [], userId: perfilId, deISO: w.de, ateISO: w.ate, config });
      const aw = temAgendaPropria(linha.u) ? metricasAgenda({ blocos: blocosAgenda || [], feedbacks: feedbacksAgenda || [], userId: perfilId, deISO: w.de, ateISO: w.ate, cfg: cfgAgenda }) : null;
      s.historicos.push({ rotulo: w.rotulo, valor: mw.historicosRegistrados });
      s.finalizados.push({ rotulo: w.rotulo, valor: mw.finalizadosNoPeriodo });
      s.ciNoPrazo.push({ rotulo: w.rotulo, valor: cw.pctNoPrazo });
      s.agenda.push({ rotulo: w.rotulo, valor: aw ? aw.taxaCumprimento : null });
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilId, !!linha, claims, overrides, historico, atendTemplateCfg, templates, tasks, cis, blocosAgenda, feedbacksAgenda]);

  function verSinistros(uid, extra) {
    resetListFilter();
    patchListFilter({ responsavel: uid, aberto: true, showFilters: true, ...extra });
    navigate("sinistros");
  }

  const modalRegistro = isAdminUser && novoRegistroPara && (
    <NovoRegistroModal operacionais={users} preSelecionados={novoRegistroPara} autor={currentUser} onClose={() => setNovoRegistroPara(null)} />
  );
  const periodo = <PeriodoChips periodoDe={periodoDe} periodoAte={periodoAte} setPeriodoDe={setPeriodoDe} setPeriodoAte={setPeriodoAte} />;

  if (perfilId) {
    if (!linha || !linha.m) {
      return <div className="page-enter"><EmptyState>{isAdminUser ? "Usuário não encontrado." : "O Desempenho mostra os indicadores da equipe operacional (Atendentes e Analistas)."}</EmptyState></div>;
    }
    const { u, m, ex, ci, agenda, conduta, as, indice, roteiro } = linha;
    const proprio = currentUser && currentUser.id === u.id;
    const minhasCIs = tasks.filter((x) => x && (x.destinatarios || []).includes(u.id) && x.origem !== u.id && x.status !== "Concluído" && !x.arquivadoManualmente);
    const ciInfo = {
      abertas: minhasCIs.length,
      urgentes: minhasCIs.filter((x) => x.urgencia === "Urgente").length,
      semInteracao: minhasCIs.filter((x) => !(x.ciente && x.ciente[u.id]) && !(x.comments || []).some((c) => c.userId === u.id)).length,
      intervencoes: intervencoesPendentes(tasks, u.id).length,
    };
    const fila = filaDoDia({ claims, overrides, tasks, userId: u.id, atendTemplateCfg, templates, roteiro });
    const analise = comExtras(comCI(comConduta(comAgenda(gerarFeedbackEPlanoDeAcao(m, metricas), agenda), conduta), ci, fmtPct), ex, as);
    const alertasCarteira = ex.semProximaAcao + ex.etapasForaPrazo + ex.emailsPendentes;
    return (
      <div className="page-enter desemp">
        <HeroOperador
          u={u} foto={m.usuarioFoto} indice={indice} mediaEquipe={mediaEquipe} periodoLabel={periodoLabel} proprio={proprio}
          onVoltar={isAdminUser ? () => navigate("desempenho") : null}
          acoes={<>
            {(isAdminUser || proprio) && <FotoUpload u={u} config={config} saveRecord={saveRecord} />}
            {isAdminUser && <button className="btn xs" onClick={() => setNovoRegistroPara([u.id])}>+ Registro</button>}
          </>}
        />
        {periodo}
        <HojeGrid roteiro={roteiro} t={t} ex={ex} ciInfo={ciInfo} alertas={alertasCarteira} navigate={(r) => (r === "sinistros" ? verSinistros(u.id, {}) : navigate(r))} />
        <div className="desemp-2col">
          <FilaDoDiaCard itens={fila} navigate={navigate} />
          <FeedbackCard key={periodoLabel} analise={analise} u={u} periodoLabel={periodoLabel} verSinistros={(f) => verSinistros(u.id, f)} />
        </div>
        <ImpactoCard indice={indice} navigate={navigate} />
        <PilaresCard indice={indice} pesos={pesos} />
        <RitmoOperadorCard ritmo={records.corp_desempenho_ritmo} u={u} />
        {series && <TendenciaCard series={series} />}

        <div className="desemp-abas">
          <div className="tabs">
            {ABAS.map(([k, label]) => (
              <button key={k} type="button" className={"tab" + (aba === k ? " active" : "")} onClick={() => setAba(k)}>{label}</button>
            ))}
          </div>
        </div>
        {aba === "processos" && <DetalheProcessos m={m} ex={ex} as={as} periodoLabel={periodoLabel} verSinistros={(f) => verSinistros(u.id, f)} />}
        {aba === "ci" && <CIDesempenhoCard m={ci} periodoLabel={periodoLabel} onVerCIs={() => navigate("tarefas")} />}
        {aba === "agenda" && (
          agenda ? (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Agenda ({periodoLabel})</h3>
              <IndicadoresAgendaGrid m={agenda} cfg={cfgAgenda} />
              <button className="btn ghost xs" style={{ marginTop: 10 }} onClick={() => navigate("agenda")}>Abrir Agenda</button>
            </div>
          ) : <div className="card"><EmptyState>Este usuário não tem agenda própria.</EmptyState></div>
        )}
        {aba === "conduta" && <CondutaPerfilCard mc={conduta} users={todosUsuarios} periodoLabel={periodoLabel} isAdminUser={isAdminUser} onNovo={() => setNovoRegistroPara([u.id])} />}
        {modalRegistro}
      </div>
    );
  }

  return (
    <div className="page-enter desemp">
      <div className="desemp-equipe-barra">
        {periodo}
        <div style={{ display: "flex", gap: 8 }}>
          {isAdminUser && <button className={"btn sm" + (verRitmo ? "" : " sec")} onClick={() => setVerRitmo((v) => !v)}>📈 Ritmo do dia</button>}
          {isAdminUser && <button className="btn sm" onClick={() => setNovoRegistroPara([])}>+ Novo registro</button>}
        </div>
      </div>
      {isAdminUser && verRitmo && <RitmoEquipe ritmo={records.corp_desempenho_ritmo} operadores={users} navigate={navigate} />}
      {!linhas.length ? <div className="card"><EmptyState>Nenhum Atendente/Analista cadastrado.</EmptyState></div> : (
        <EquipeView linhas={linhas} t={t} navigate={navigate} periodoLabel={periodoLabel} />
      )}
      {modalRegistro}
    </div>
  );
}
