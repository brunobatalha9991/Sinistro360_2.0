import {
  campoEfetivo, getResponsavel, getNextAction, getSitAtend, getTemp, loadComms, loadAudit,
  situacaoEfetiva, currentStage, diasEmAberto, tempoNaEtapaAtual,
} from "./claims";
import { ultimoHistorico } from "./relatorioAcompanhamento";
import { atividadesDoUsuario } from "./desempenhoAtividades";
import { responsavelVigenteEm } from "./responsabilidade";

// Relatório de Sinistros (a pedido do usuário, modelo do PDF "edição da
// noite" de 12/11/2026): fotografia dos processos em aberto com prazos,
// termômetro, demanda de cada operador, alertas, CIs em aberto, comparação
// com a última leitura gravada e o previsto para o próximo dia útil.
// Função pura — recebe os dados e o "agora", devolve tudo calculado; a tela
// (components/relatorios/RelatorioSinistros.jsx) só desenha.

export const SEM_RESPONSAVEL = "Sem responsável";
export const CHAVE_LEITURAS = "corp_relatorio_sinistros_leituras";
const MAX_LEITURAS = 60;

// Seguradoras somadas (ordem do Bruno em 04/11): Porto, Azul, Itaú e Mitsui
// como PORTO; ALLI e ALLIANZ como ALLIANZ.
const GRUPO_SEGURADORA = {
  PORTO: "PORTO", PORT: "PORTO", AZUL: "PORTO", ITAU: "PORTO", "ITAÚ": "PORTO", MITSUI: "PORTO", MITSI: "PORTO",
  ALLI: "ALLIANZ", ALLIANZ: "ALLIANZ",
};
export const NOTA_SEGURADORAS = "Porto, Azul, Itaú e Mitsui somadas como PORTO. ALLI e ALLIANZ somadas como ALLIANZ.";

export function grupoSeguradora(cia) {
  const v = String(cia || "").trim().toUpperCase();
  if (!v) return "—";
  return GRUPO_SEGURADORA[v] || v;
}

// Termômetro normalizado: grave | atencao | moderado | tranquilo | sem.
export const TERMOMETROS = [
  ["grave", "Grave"], ["atencao", "Em atenção"], ["moderado", "Moderado"], ["tranquilo", "Tranquilo"], ["sem", "Sem termômetro"],
];
export function termometroKey(t) {
  const s = String(t || "").toLowerCase();
  if (s.indexOf("grave") >= 0) return "grave";
  if (s.indexOf("aten") >= 0) return "atencao";
  if (s.indexOf("moder") >= 0) return "moderado";
  if (s.indexOf("tranq") >= 0) return "tranquilo";
  return "sem";
}
const RANK_TERMO = { grave: 0, atencao: 1, moderado: 2, tranquilo: 3, sem: 4 };
export function rotuloTermometro(k) { return (TERMOMETROS.find((x) => x[0] === k) || TERMOMETROS[4])[1]; }

const RANK_PRAZO = { atrasado: 0, hoje: 1, noprazo: 2, semprazo: 3 };

export function dataLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function diasEntreISO(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
// Próximo dia útil (segunda a sexta) depois de `hojeISO`.
export function proximoDiaUtil(hojeISO) {
  const [y, m, d] = hojeISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  do { dt.setDate(dt.getDate() + 1); } while (dt.getDay() === 0 || dt.getDay() === 6);
  return dataLocalISO(dt);
}

function tipoCurto(c) {
  if (c.partyType === "Aviso") return "Aten.";
  if (c.partyType === "Terceiro") return "Terc.";
  return "Segu.";
}

export function processoEmAberto(overrides, c, atendTemplate, templates) {
  const l = situacaoEfetiva(overrides, c, atendTemplate, templates).label;
  return l === "Pendente" || l === "Em andamento";
}

// Uma linha por processo em aberto, com tudo o que o relatório mostra.
export function linhaProcesso({ overrides, c, atendTemplate, templates, hojeISO, agora }) {
  const resp = getResponsavel(overrides, c.id);
  const na = getNextAction(overrides, c.id);
  const ult = ultimoHistorico(loadComms(overrides, c.id));
  const termo = termometroKey(getTemp(overrides, c.id));
  const prazoData = (na && na.date) || "";
  let prazo = "semprazo";
  let diasAtraso = null;
  if (prazoData) {
    const dif = diasEntreISO(prazoData, hojeISO);
    if (dif > 0) { prazo = "atrasado"; diasAtraso = dif; } else if (dif === 0) prazo = "hoje"; else prazo = "noprazo";
  }
  const aberto = diasEmAberto(overrides, templates, atendTemplate, c, agora);
  const etapaT = tempoNaEtapaAtual(overrides, templates, atendTemplate, c, agora);
  return {
    id: c.id,
    numero: campoEfetivo(overrides, c, "numsin") || (c.nosnum ? "#" + c.nosnum : "—"),
    segurado: campoEfetivo(overrides, c, "segurado") || "—",
    seguradora: grupoSeguradora(campoEfetivo(overrides, c, "cia")),
    tipo: tipoCurto(c),
    tipoKey: c.partyType === "Aviso" ? "atendimento" : c.partyType === "Terceiro" ? "terceiro" : "segurado",
    responsavel: (resp && resp.nome) || SEM_RESPONSAVEL,
    situacao: situacaoEfetiva(overrides, c, atendTemplate, templates).label,
    sitAtend: getSitAtend(overrides, c.id),
    etapa: currentStage(overrides, templates, atendTemplate, c) || "—",
    termometro: termo,
    ultHistData: (ult && ult.data) || "",
    ultHistTexto: (ult && ult.texto) || "",
    diasSemHistorico: ult && ult.data ? Math.max(0, diasEntreISO(ult.data, hojeISO)) : null,
    proxTitulo: (na && na.title) || "",
    prazoData, prazo, diasAtraso,
    diasAberto: aberto && !aberto.encerrado ? aberto.dias : null,
    diasEtapa: etapaT && etapaT.dias != null ? etapaT.dias : null,
  };
}

// Ordem do modelo: atrasados (mais antigos primeiro), vencem hoje, no
// prazo, sem prazo; em cada grupo, termômetro mais grave primeiro.
export function ordenarDemanda(linhas) {
  return [...linhas].sort((a, b) =>
    RANK_PRAZO[a.prazo] - RANK_PRAZO[b.prazo]
    || (a.prazo === "atrasado" ? (b.diasAtraso || 0) - (a.diasAtraso || 0) : 0)
    || RANK_TERMO[a.termometro] - RANK_TERMO[b.termometro]
    || String(a.prazoData).localeCompare(String(b.prazoData))
    || a.segurado.localeCompare(b.segurado, "pt-BR"));
}

const media = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const maior = (xs) => (xs.length ? Math.max(...xs) : null);
const contar = (ls, fn) => ls.filter(fn).length;

function resumoGrupo(ls) {
  const atrasos = ls.filter((l) => l.prazo === "atrasado").map((l) => l.diasAtraso);
  const abertos = ls.map((l) => l.diasAberto).filter((x) => x != null);
  const etapas = ls.map((l) => l.diasEtapa).filter((x) => x != null);
  return {
    processos: ls.length,
    atrasados: atrasos.length,
    hoje: contar(ls, (l) => l.prazo === "hoje"),
    noprazo: contar(ls, (l) => l.prazo === "noprazo"),
    semprazo: contar(ls, (l) => l.prazo === "semprazo"),
    grave: contar(ls, (l) => l.termometro === "grave"),
    atencao: contar(ls, (l) => l.termometro === "atencao"),
    moderado: contar(ls, (l) => l.termometro === "moderado"),
    tranquilo: contar(ls, (l) => l.termometro === "tranquilo"),
    semTermo: contar(ls, (l) => l.termometro === "sem"),
    atrasoMedio: media(atrasos),
    mediaAberto: media(abertos), maiorAberto: maior(abertos),
    mediaEtapa: media(etapas), maiorEtapa: maior(etapas),
  };
}

function contagemOrdenada(ls, fn) {
  const m = {};
  ls.forEach((l) => { const k = fn(l); m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "pt-BR"));
}

// CIs em aberto: assunto, destinatários (responsáveis), abertura e última interação.
export function cisEmAberto(tasks, users) {
  const nome = (id) => ((users || []).find((u) => u.id === id) || {}).nome || "?";
  return (tasks || [])
    .filter((t) => t && t.status !== "Concluído" && !t.arquivadoManualmente)
    .map((t) => {
      let ultima = t.updatedAt || t.createdAt || "";
      (t.comments || []).forEach((cm) => { if (cm.at && String(cm.at) > ultima) ultima = String(cm.at); });
      const destinatarioNomes = (t.destinatarios || []).map(nome);
      return {
        id: t.id, ci: t.ci || "—", assunto: t.titulo || "", tipo: t.tipo || "",
        destinatarioNomes,
        responsavel: destinatarioNomes.join(", ") || "—",
        abertaEm: t.createdAt || "", ultima,
      };
    })
    .sort((a, b) => String(b.ultima).localeCompare(String(a.ultima)));
}

// Indicadores gravados em cada "leitura" (pra comparar com a próxima).
export function indicadoresLeitura(rel) {
  const porOperador = {};
  rel.operadores.forEach((o) => { porOperador[o.nome] = o.resumo.atrasados; });
  return {
    emAberto: rel.total.processos, atrasados: rel.total.atrasados, hoje: rel.total.hoje,
    graves: rel.total.grave, atencao: rel.total.atencao, porOperador,
  };
}

// Última leitura gravada ANTES de hoje (a de hoje é a que está sendo lida).
export function leituraAnterior(leituras, hojeISO) {
  return (Array.isArray(leituras) ? leituras : [])
    .filter((l) => l && l.data && l.data < hojeISO)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
}

// Grava a leitura de hoje (substitui a do mesmo dia) e mantém as últimas 60.
export function gravarLeitura(leituras, rel, agora) {
  const data = dataLocalISO(agora);
  const nova = { at: agora.toISOString(), data, ind: indicadoresLeitura(rel) };
  const outras = (Array.isArray(leituras) ? leituras : []).filter((l) => l && l.data !== data);
  return [...outras, nova].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-MAX_LEITURAS);
}

export function comparativo(rel, anterior) {
  if (!anterior) return null;
  const agora = indicadoresLeitura(rel);
  const ant = anterior.ind || {};
  const linha = (label, a, b) => ({ label, antes: a == null ? null : a, agora: b, variacao: a == null ? null : b - a });
  const out = [
    linha("Processos em aberto", ant.emAberto, agora.emAberto),
    linha("Próximas ações atrasadas", ant.atrasados, agora.atrasados),
    linha("Vencem hoje (ainda abertas)", ant.hoje, agora.hoje),
    linha("Graves", ant.graves, agora.graves),
    linha("Em atenção", ant.atencao, agora.atencao),
  ];
  const nomes = [...new Set([...Object.keys(agora.porOperador), ...Object.keys(ant.porOperador || {})])];
  nomes.forEach((n) => out.push(linha(`Atrasados de ${n}`, (ant.porOperador || {})[n], agora.porOperador[n] || 0)));
  return { data: anterior.data, at: anterior.at, linhas: out };
}

// Desempenho do agente de IA no dia (a pedido do usuário, fim do
// relatório): para cada usuário com o botão "IA" (Configurações →
// Usuários, u.ia), o que ele fez hoje AGRUPADO por processo e por CI —
// nada de ação por ação. Em cada processo: quem era o responsável quando o
// agente atuou, como estava (próxima ação atrasada? quantos dias sem
// histórico?), o que o agente fez e como ficou agora (regularizou ou segue
// atrasado). Em cada CI: o papel do agente, o que fez e se os
// destinatários responderam depois. Mais um quadro por responsável. Usa a
// mesma linha do tempo do módulo Desempenho (atividadesDoUsuario). Não
// depende dos filtros do relatório.
const DIAS_PARADO = 3;

// Prazo da próxima ação vigente num instante, pela auditoria ("Próxima
// ação definida — prazo dd/mm/aaaa" / "concluída/removida"). Sem registro
// antes do instante: o valor atual (se nunca foi trocado) ou "sem".
function prazoVigenteEm(overrides, claimId, instanteISO) {
  const eventos = loadAudit(overrides, claimId)
    .filter((a) => a && a.at && (a.acao === "Próxima ação definida" || a.acao === "Próxima ação concluída/removida"))
    .map((a) => {
      const m = String(a.detalhe || "").match(/prazo (\d{2})\/(\d{2})\/(\d{4})/);
      return { at: String(a.at), prazo: a.acao === "Próxima ação definida" && m ? `${m[3]}-${m[2]}-${m[1]}` : null };
    });
  const antes = eventos.filter((e) => e.at < instanteISO).sort((a, b) => a.at.localeCompare(b.at)).pop();
  if (antes) return antes.prazo;
  if (eventos.length) return null;
  const na = getNextAction(overrides, claimId);
  return (na && na.date) || null;
}
function situacaoPrazo(prazoISO, diaISO) {
  if (!prazoISO) return { prazo: "semprazo", dias: null };
  const dif = diasEntreISO(prazoISO, diaISO);
  if (dif > 0) return { prazo: "atrasado", dias: dif };
  return { prazo: dif === 0 ? "hoje" : "noprazo", dias: null };
}
// Último histórico registrado ANTES do instante (de qualquer pessoa).
function ultimoHistoricoAntes(overrides, claimId, instanteISO) {
  let ult = "";
  loadComms(overrides, claimId).forEach((m) => {
    const at = m.at || (m.date ? m.date + "T12:00:00" : "");
    if (at && String(at) < instanteISO && String(at) > ult) ult = String(at);
  });
  return ult;
}

const ROTULO_GRUPO = {
  historico: ["histórico", "históricos"], jornada: ["jornada", "jornada"],
  proxima_acao: ["próxima ação", "próximas ações"], processo: ["outra atualização", "outras atualizações"],
};
function resumoFeito(acoes) {
  const cont = {};
  acoes.forEach((a) => { cont[a.grupo] = (cont[a.grupo] || 0) + 1; });
  const partes = ["historico", "jornada", "proxima_acao", "processo"].filter((g) => cont[g])
    .map((g) => `${cont[g]} ${cont[g] === 1 ? ROTULO_GRUPO[g][0] : ROTULO_GRUPO[g][1]}`);
  const jornada = [...new Set(acoes.filter((a) => a.grupo === "jornada").map((a) => String(a.titulo).replace(/^Jornada:\s*/, "")))].slice(0, 2);
  return { texto: partes.join(", ") || "—", jornada };
}

function horaDe(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function desempenhoAgentesIA({ claims, overrides = {}, tasks, users, feedbacksAgenda, historicoResp, hojeISO, agora = new Date() }) {
  const nomeUser = (id) => ((users || []).find((u) => u.id === id) || {}).nome || null;
  const claimPorId = {};
  (claims || []).forEach((c) => { claimPorId[c.id] = c; });
  const taskPorId = {};
  (tasks || []).forEach((t) => { if (t) taskPorId[t.id] = t; });

  return (users || []).filter((u) => u && u.ia).map((u) => {
    const atividades = atividadesDoUsuario({ claims, overrides, tasks, feedbacksAgenda, usuario: { id: u.id, nome: u.nome }, deISO: hojeISO, ateISO: hojeISO });
    const doDia = (iso) => !!iso && dataLocalISO(new Date(iso)) === hojeISO;

    // ---------- processos ----------
    const porProc = {};
    atividades.forEach((a) => { if (a.rota && a.rota[0] === "sinistro") (porProc[a.rota[1]] = porProc[a.rota[1]] || []).push(a); });
    const processos = Object.keys(porProc).map((id) => {
      const c = claimPorId[id];
      const acoes = porProc[id].slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
      const primeira = String(acoes[0].at);
      const ultima = String(acoes[acoes.length - 1].at);
      const respAtual = getResponsavel(overrides, id);
      const vig = responsavelVigenteEm(historicoResp, id, primeira);
      const respNaHora = (vig && (nomeUser(vig.usuarioResponsavelId) || vig.usuarioResponsavelNome)) || (respAtual && respAtual.nome) || SEM_RESPONSAVEL;
      const antes = situacaoPrazo(prazoVigenteEm(overrides, id, primeira), hojeISO);
      const ultHist = ultimoHistoricoAntes(overrides, id, primeira);
      const diasSemHist = ultHist ? Math.max(0, diasEntreISO(dataLocalISO(new Date(ultHist)), hojeISO)) : null;
      const naAgora = getNextAction(overrides, id);
      const depois = situacaoPrazo((naAgora && naAgora.date) || null, hojeISO);
      const estavaAtrasado = antes.prazo === "atrasado";
      let resultado = "ok";
      if (depois.prazo === "atrasado") resultado = "segue_atrasado";
      else if (depois.prazo === "semprazo") resultado = "sem_proxima";
      else if (estavaAtrasado) resultado = "regularizado";
      return {
        id,
        numero: c ? campoEfetivo(overrides, c, "numsin") || (c.nosnum ? "#" + c.nosnum : "—") : "—",
        segurado: c ? campoEfetivo(overrides, c, "segurado") || "—" : (acoes[0].alvo || "—"),
        seguradora: c ? grupoSeguradora(campoEfetivo(overrides, c, "cia")) : "—",
        respNaHora, respAtual: (respAtual && respAtual.nome) || SEM_RESPONSAVEL,
        antes, diasSemHist, parado: diasSemHist == null || diasSemHist > DIAS_PARADO,
        feito: resumoFeito(acoes), qtdAcoes: acoes.length,
        depois, prazoAgora: (naAgora && naAgora.date) || "", proxTitulo: (naAgora && naAgora.title) || "",
        termometro: termometroKey(getTemp(overrides, id)),
        resultado, horario: horaDe(primeira) + (ultima !== primeira ? "–" + horaDe(ultima) : ""),
      };
    }).sort((a, b) => (b.antes.prazo === "atrasado") - (a.antes.prazo === "atrasado") || (b.antes.dias || 0) - (a.antes.dias || 0) || a.respNaHora.localeCompare(b.respNaHora, "pt-BR"));

    // Quadro por responsável (de quem eram os processos em que o agente atuou).
    const porResp = {};
    processos.forEach((p) => {
      const r = (porResp[p.respNaHora] = porResp[p.respNaHora] || { nome: p.respNaHora, processos: 0, atrasados: 0, parados: 0, regularizados: 0, seguemAtrasados: 0 });
      r.processos++;
      if (p.antes.prazo === "atrasado") r.atrasados++;
      if (p.parado) r.parados++;
      if (p.resultado === "regularizado") r.regularizados++;
      if (p.resultado === "segue_atrasado") r.seguemAtrasados++;
    });
    const porResponsavel = Object.values(porResp).sort((a, b) => b.processos - a.processos || a.nome.localeCompare(b.nome, "pt-BR"));

    // ---------- CIs ----------
    const porCI = {};
    atividades.forEach((a) => {
      if (a.rota && a.rota[0] === "tarefas") {
        const id = String(a.rota[1]).replace(/^open-/, "");
        (porCI[id] = porCI[id] || []).push(a);
      }
    });
    // Intervenções do agente hoje também contam como atuação na CI.
    (tasks || []).forEach((t) => {
      if (t && (t.intervencoes || []).some((iv) => iv.autorId === u.id && doDia(iv.at)) && !porCI[t.id]) porCI[t.id] = [];
    });
    const cis = Object.keys(porCI).map((id) => {
      const t = taskPorId[id] || {};
      const acoes = porCI[id];
      const abriu = t.origem === u.id && doDia(t.createdAt);
      const comentarios = acoes.filter((a) => a.titulo === "Comentou na CI").length;
      const intervencoes = (t.intervencoes || []).filter((iv) => iv.autorId === u.id && doDia(iv.at));
      const outras = acoes.filter((a) => !["Comentou na CI", "Abriu a CI", "Fez uma intervenção"].includes(a.titulo)).length;
      const feito = [
        abriu && "abriu",
        comentarios && `${comentarios} comentário(s)`,
        intervencoes.length && `${intervencoes.length} intervenção(ões)`,
        outras && `${outras} alteração(ões)`,
      ].filter(Boolean).join(", ") || "—";
      const ultimaDoAgente = [...acoes.map((a) => String(a.at)), ...intervencoes.map((iv) => String(iv.at))].sort().pop() || "";
      // Resposta dos destinatários depois da última atuação do agente.
      const dests = (t.destinatarios || []).filter((x) => x && x !== u.id);
      const respostas = (t.comments || []).filter((cm) => cm && dests.includes(cm.userId) && String(cm.at) > ultimaDoAgente)
        .sort((a, b) => String(a.at).localeCompare(String(b.at)));
      const horasSem = ultimaDoAgente ? Math.floor((agora.getTime() - new Date(ultimaDoAgente).getTime()) / 3600000) : null;
      const pendIv = intervencoes.reduce((s, iv) => s + (iv.alvos || [])
        .filter((x) => !(iv.respostas && iv.respostas[x]) && !(iv.dispensas && iv.dispensas[x])).length, 0);
      let resposta;
      if (t.status === "Concluído") resposta = { tipo: "concluida", texto: `Concluída${t.concludedAt ? " às " + horaDe(t.concludedAt) : ""}` };
      else if (respostas.length) resposta = { tipo: "respondeu", texto: `${nomeUser(respostas[0].userId) || "?"} respondeu às ${horaDe(respostas[0].at)}` };
      else resposta = { tipo: "sem_resposta", texto: horasSem == null ? "Sem resposta" : `Sem resposta há ${horasSem} h` };
      return {
        id, ci: t.ci || "—", assunto: t.titulo || "", status: t.status || "—",
        papel: abriu ? "Abriu" : t.origem === u.id ? "Origem" : (t.destinatarios || []).includes(u.id) ? "Destinatário" : "Atuou",
        destinatarios: dests.map((x) => nomeUser(x) || "?").join(", ") || "—",
        feito, resposta, intervencoesPendentes: pendIv, ultimaDoAgente,
        intervencoesHoje: intervencoes.length,
      };
    }).sort((a, b) => (a.resposta.tipo === "sem_resposta" ? 0 : 1) - (b.resposta.tipo === "sem_resposta" ? 0 : 1)
      || String(b.ultimaDoAgente).localeCompare(String(a.ultimaDoAgente)));

    const criadas = (tasks || []).filter((t) => t && t.origem === u.id);
    return {
      id: u.id, nome: u.nome,
      resumo: {
        processos: processos.length,
        atrasadosAoAtuar: processos.filter((p) => p.antes.prazo === "atrasado").length,
        paradosAoAtuar: processos.filter((p) => p.parado).length,
        regularizados: processos.filter((p) => p.resultado === "regularizado").length,
        seguemAtrasados: processos.filter((p) => p.resultado === "segue_atrasado").length,
        semProxima: processos.filter((p) => p.resultado === "sem_proxima").length,
        cis: cis.length,
        cisAbertasHoje: criadas.filter((t) => doDia(t.createdAt)).length,
        cisConcluidasHoje: criadas.filter((t) => t.status === "Concluído" && doDia(t.concludedAt)).length,
        cisEmAberto: criadas.filter((t) => t.status !== "Concluído" && !t.arquivadoManualmente).length,
        cisSemResposta: cis.filter((c) => c.resposta.tipo === "sem_resposta").length,
        intervencoes: cis.reduce((s, c) => s + c.intervencoesHoje, 0),
      },
      processos, porResponsavel, cis,
    };
  });
}

// Filtros (a pedido do usuário — relatório global ou individual):
// { responsavel, seguradora, tipo }; vazio/"todos" = sem filtro.
export const TIPOS_FILTRO = [["segurado", "Segurado"], ["terceiro", "Terceiro"], ["atendimento", "Atendimento"]];
const ativo = (v) => !!v && v !== "todos";
export function filtrosAtivos(f) {
  return !!f && (ativo(f.responsavel) || ativo(f.seguradora) || ativo(f.tipo));
}

export function montarRelatorioSinistros({ claims, overrides = {}, tasks, users, atendTemplate, templates = {}, agora = new Date(), leituras, filtros, feedbacksAgenda, claimsTodos, historicoResp }) {
  const hojeISO = dataLocalISO(agora);
  const abertos = (claims || []).filter((c) => processoEmAberto(overrides, c, atendTemplate, templates));
  const todasLinhas = abertos.map((c) => linhaProcesso({ overrides, c, atendTemplate, templates, hojeISO, agora }));
  const f = filtros || {};
  // Opções dos filtros saem do conjunto completo (não somem ao filtrar).
  const opcoes = {
    responsaveis: [...new Set(todasLinhas.map((l) => l.responsavel))]
      .sort((a, b) => (a === SEM_RESPONSAVEL) - (b === SEM_RESPONSAVEL) || a.localeCompare(b, "pt-BR")),
    seguradoras: [...new Set(todasLinhas.map((l) => l.seguradora))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
  const linhas = todasLinhas.filter((l) =>
    (!ativo(f.responsavel) || l.responsavel === f.responsavel)
    && (!ativo(f.seguradora) || l.seguradora === f.seguradora)
    && (!ativo(f.tipo) || l.tipoKey === f.tipo));
  const total = resumoGrupo(linhas);

  // Operadores: mais processos primeiro; "Sem responsável" por último.
  const porNome = {};
  linhas.forEach((l) => { (porNome[l.responsavel] = porNome[l.responsavel] || []).push(l); });
  const operadores = Object.keys(porNome)
    .map((nome) => ({ nome, resumo: resumoGrupo(porNome[nome]), linhas: ordenarDemanda(porNome[nome]) }))
    .sort((a, b) => (a.nome === SEM_RESPONSAVEL) - (b.nome === SEM_RESPONSAVEL) || b.resumo.processos - a.resumo.processos || a.nome.localeCompare(b.nome, "pt-BR"));

  const atrasos = linhas.filter((l) => l.prazo === "atrasado").map((l) => l.diasAtraso);
  const semHist = linhas.map((l) => l.diasSemHistorico).filter((x) => x != null);
  const indicadores = {
    segurados: contar(linhas, (l) => l.tipoKey === "segurado"),
    terceiros: contar(linhas, (l) => l.tipoKey === "terceiro"),
    atendimentos: contar(linhas, (l) => l.tipoKey === "atendimento"),
    emAndamento: contar(linhas, (l) => l.situacao === "Em andamento"),
    pendente: contar(linhas, (l) => l.situacao === "Pendente"),
    moderado: total.moderado,
    atrasoMedio: total.atrasoMedio, maiorAtraso: maior(atrasos),
    atrasados30: contar(linhas, (l) => l.prazo === "atrasado" && l.diasAtraso > 30),
    mediaAberto: total.mediaAberto, comDadoAberto: contar(linhas, (l) => l.diasAberto != null),
    mediaEtapa: total.mediaEtapa, maiorEtapa: total.maiorEtapa,
    mediaSemHistorico: media(semHist),
    semContato7: contar(linhas, (l) => l.diasSemHistorico != null && l.diasSemHistorico > 7),
    semHistorico: contar(linhas, (l) => !l.ultHistData && !l.ultHistTexto),
  };

  const graves = ordenarDemanda(linhas.filter((l) => l.termometro === "grave"));
  const emAtencao = ordenarDemanda(linhas.filter((l) => l.termometro === "atencao"));
  const atrasados30 = linhas.filter((l) => l.prazo === "atrasado" && l.diasAtraso > 30).sort((a, b) => b.diasAtraso - a.diasAtraso);

  // Individual: só as CIs em que o operador é destinatário.
  const cis = cisEmAberto(tasks, users).filter((c) => !ativo(f.responsavel) || c.destinatarioNomes.includes(f.responsavel));
  const cisPorResponsavel = contagemOrdenada(cis, (c) => c.responsavel);

  const amanha = proximoDiaUtil(hojeISO);
  const previstos = linhas.filter((l) => l.prazoData === amanha)
    .sort((a, b) => (a.responsavel === SEM_RESPONSAVEL) - (b.responsavel === SEM_RESPONSAVEL) || a.responsavel.localeCompare(b.responsavel, "pt-BR")
      || RANK_TERMO[a.termometro] - RANK_TERMO[b.termometro] || a.segurado.localeCompare(b.segurado, "pt-BR"));
  const previstoPorOperador = operadores.map((o) => ({
    nome: o.nome, vencem: o.linhas.filter((l) => l.prazoData === amanha).length, atrasados: o.resumo.atrasados,
  }));

  const rel = {
    hojeISO, geradoEm: agora.toISOString(), linhas, total, indicadores, operadores, filtros: f, opcoes, filtrado: filtrosAtivos(f),
    porSeguradora: contagemOrdenada(linhas, (l) => l.seguradora),
    porEtapa: contagemOrdenada(linhas, (l) => l.etapa),
    alertas: { graves, emAtencao, atrasados30 },
    cis, cisPorResponsavel,
    previsto: { data: amanha, linhas: previstos, porOperador: previstoPorOperador },
    agentesIA: desempenhoAgentesIA({ claims: claimsTodos || claims, overrides, tasks, users, feedbacksAgenda, historicoResp, hojeISO, agora }),
  };
  // A leitura gravada é sempre a global. Global: compara tudo. Só operador
  // escolhido: compara os atrasados dele. Outros recortes não têm base.
  const anterior = leituraAnterior(leituras, hojeISO);
  if (!rel.filtrado) rel.comparativo = comparativo(rel, anterior);
  else if (ativo(f.responsavel) && !ativo(f.seguradora) && !ativo(f.tipo) && anterior) {
    const antes = ((anterior.ind || {}).porOperador || {})[f.responsavel];
    rel.comparativo = {
      data: anterior.data, at: anterior.at,
      linhas: [{ label: `Atrasados de ${f.responsavel}`, antes: antes == null ? null : antes, agora: total.atrasados, variacao: antes == null ? null : total.atrasados - antes }],
    };
  } else rel.comparativo = null;
  return rel;
}
