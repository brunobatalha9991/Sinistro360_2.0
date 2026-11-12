import {
  campoEfetivo, getResponsavel, getNextAction, getSitAtend, getTemp, loadComms,
  situacaoEfetiva, currentStage, diasEmAberto, tempoNaEtapaAtual,
} from "./claims";
import { ultimoHistorico } from "./relatorioAcompanhamento";

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
      return {
        id: t.id, ci: t.ci || "—", assunto: t.titulo || "", tipo: t.tipo || "",
        responsavel: (t.destinatarios || []).map(nome).join(", ") || "—",
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

export function montarRelatorioSinistros({ claims, overrides = {}, tasks, users, atendTemplate, templates = {}, agora = new Date(), leituras }) {
  const hojeISO = dataLocalISO(agora);
  const abertos = (claims || []).filter((c) => processoEmAberto(overrides, c, atendTemplate, templates));
  const linhas = abertos.map((c) => linhaProcesso({ overrides, c, atendTemplate, templates, hojeISO, agora }));
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

  const cis = cisEmAberto(tasks, users);
  const cisPorResponsavel = contagemOrdenada(cis, (c) => c.responsavel);

  const amanha = proximoDiaUtil(hojeISO);
  const previstos = linhas.filter((l) => l.prazoData === amanha)
    .sort((a, b) => (a.responsavel === SEM_RESPONSAVEL) - (b.responsavel === SEM_RESPONSAVEL) || a.responsavel.localeCompare(b.responsavel, "pt-BR")
      || RANK_TERMO[a.termometro] - RANK_TERMO[b.termometro] || a.segurado.localeCompare(b.segurado, "pt-BR"));
  const previstoPorOperador = operadores.map((o) => ({
    nome: o.nome, vencem: o.linhas.filter((l) => l.prazoData === amanha).length, atrasados: o.resumo.atrasados,
  }));

  const rel = {
    hojeISO, geradoEm: agora.toISOString(), linhas, total, indicadores, operadores,
    porSeguradora: contagemOrdenada(linhas, (l) => l.seguradora),
    porEtapa: contagemOrdenada(linhas, (l) => l.etapa),
    alertas: { graves, emAtencao, atrasados30 },
    cis, cisPorResponsavel,
    previsto: { data: amanha, linhas: previstos, porOperador: previstoPorOperador },
  };
  rel.comparativo = comparativo(rel, leituraAnterior(leituras, hojeISO));
  return rel;
}
