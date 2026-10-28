// Registro de versões/atualizações do sistema (a pedido do usuário) —
// Configurações → "Versões do sistema": cada publicação fica registrada com
// o que mudou, e dá pra gerar um relatório visual (impressão/PDF ou HTML)
// pra compartilhar com a equipe. Guardado em config.corp_versoes_sistema:
// [{ id, versao, data, hora, titulo, resumo, itens: [{ id, tipo, modulo,
// texto }] }]. Sem nada salvo ainda, vale VERSOES_INICIAIS (o histórico já
// publicado), editável normalmente.

export const TIPOS_MUDANCA = [
  { key: "novidade", label: "Novidade", plural: "novidades", icone: "✨", cor: "#2f6bff" },
  { key: "melhoria", label: "Melhoria", plural: "melhorias", icone: "⚡", cor: "#16a34a" },
  { key: "correcao", label: "Correção", plural: "correções", icone: "🛠️", cor: "#ea580c" },
];
export function tipoMudanca(key) {
  return TIPOS_MUDANCA.find((t) => t.key === key) || TIPOS_MUDANCA[0];
}

export const MODULOS_SISTEMA = [
  "Comunicação Interna", "Notificações", "Agenda", "Desempenho", "Sinistros", "Abertura", "Dashboard",
  "Clientes", "Oficinas", "Seguradoras", "Relatórios", "E-mails", "Assistente IA", "Configurações", "Geral",
];

const it = (n, tipo, modulo, texto) => ({ id: "vi_" + n, tipo, modulo, texto });

export const VERSOES_INICIAIS = [
  {
    id: "v_3_4_1", versao: "3.4.1", data: "2026-10-28", hora: "12:10",
    titulo: "Alertas de CI parada sem repetição",
    resumo: "Os alertas de CI sem interação passam a funcionar como um conjunto: cada pessoa recebe no máximo um por CI, e o \"Considerar\" resolve tudo.",
    itens: [
      it(1, "melhoria", "Notificações", "Cada pessoa tem no máximo um alerta aberto por CI. A prioridade é: pedido de intervenção, depois alerta dos gestores, depois alerta ao criador. O alerta novo substitui o anterior."),
      it(2, "melhoria", "Comunicação Interna", "\"Considerar\", \"Intervir\" e dispensar o pedido de intervenção resolvem os alertas abertos daquela CI para todos."),
      it(3, "melhoria", "Notificações", "Os alertas se resolvem sozinhos quando um destinatário interage ou quando a CI é concluída ou arquivada. O card mostra o motivo."),
    ],
  },
  {
    id: "v_3_4_0", versao: "3.4.0", data: "2026-10-28", hora: "11:53",
    titulo: "CI emergencial × almoço e café",
    resumo: "As CIs de Assistência 24h e Carro Reserva não ficam paradas durante as pausas da equipe.",
    itens: [
      it(4, "novidade", "Comunicação Interna", "Quando um destinatário entra em almoço ou café (pela Agenda), a CI de Assistência 24h ou Carro Reserva vai para todos os operadores, com comentário automático."),
      it(5, "novidade", "Comunicação Interna", "Os destinatários recebem uma tela cheia que só sai com \"Ciente\". No fim da pausa, a CI volta sozinha para os destinatários originais."),
      it(6, "novidade", "Notificações", "Botão \"✓ Ok\" em todas as notificações: confirma a leitura e deixa o card opaco."),
      it(7, "novidade", "Notificações", "Item \"Notificações\" no menu lateral, com o contador de não lidas."),
    ],
  },
  {
    id: "v_3_3_3", versao: "3.3.3", data: "2026-10-28", hora: "11:37",
    titulo: "Ausência sem considerar o Administrador",
    resumo: "O Administrador nunca conta como ausente na generalização de CIs.",
    itens: [
      it(8, "correcao", "Comunicação Interna", "O usuário Administrador (pelo perfil ou pelo nome) não conta mais como ausente e não entra na generalização. Isso vale inclusive para abas antigas que ainda não foram atualizadas."),
    ],
  },
  {
    id: "v_3_3_2", versao: "3.3.2", data: "2026-10-28", hora: "11:27",
    titulo: "Blindagem contra excesso de notificações",
    resumo: "Proteções extras para os alertas automáticos não se repetirem.",
    itens: [
      it(9, "correcao", "Notificações", "As versões antigas e a atual do sistema convivem sem gerar alertas em loop."),
      it(10, "melhoria", "Desempenho", "O aviso de mudança do mesmo operador sai no máximo a cada 10 minutos, e o fechamento do dia sai uma única vez."),
    ],
  },
  {
    id: "v_3_3_1", versao: "3.3.1", data: "2026-10-28", hora: "11:17",
    titulo: "Correção do loop de notificações",
    resumo: "Correção urgente: o alerta de CI sem interação estava se repetindo sem parar.",
    itens: [
      it(11, "correcao", "Notificações", "O alerta \"⏱ sem interação\" não se repete mais em loop. Alertas automáticos iguais não se repetem em menos de 5 minutos."),
    ],
  },
  {
    id: "v_3_3_0", versao: "3.3.0", data: "2026-10-28", hora: "11:08",
    titulo: "Ações rápidas na CI",
    resumo: "Menos cliques para tratar uma CI.",
    itens: [
      it(12, "novidade", "Comunicação Interna", "Dentro da CI aberta, os botões Acompanhar, Ciente e Considerar ficam ao lado de \"Intervenção\"."),
      it(13, "novidade", "Notificações", "Botão \"Ok\" nas notificações com ações: marca como tratada e deixa o card opaco."),
      it(14, "novidade", "Comunicação Interna", "\"Visualizar tarefa\" na tela cheia do pedido de intervenção: mostra os dados e o histórico da conversa sem sair da tela."),
    ],
  },
  {
    id: "v_3_2_0", versao: "3.2.0", data: "2026-10-28", hora: "10:57",
    titulo: "Índice de Desempenho também sobe",
    resumo: "O que o operador entrega no dia soma pontos, e o pedido de intervenção passa a ser em tela cheia.",
    itens: [
      it(15, "novidade", "Desempenho", "Ganhos do dia: produção, CI no prazo, intervenção respondida, agenda cumprida, atraso resolvido, carteira zerada, pontualidade e sequência sem atraso somam pontos (até +20 por dia)."),
      it(16, "novidade", "Desempenho", "Card \"Balanço do índice\" (pilares − pendências + ganhos), com as abas Somando, Tirando e Como subir. Card \"Conquistas de hoje\" na visão da equipe."),
      it(17, "novidade", "Comunicação Interna", "O pedido de intervenção vira tela cheia e exige uma decisão: Intervir, Considerar ou dispensar com justificativa."),
    ],
  },
  {
    id: "v_3_1_0", versao: "3.1.0", data: "2026-10-28", hora: "10:45",
    titulo: "Comunicação Interna, Agenda, Notificações e Desempenho",
    resumo: "Grande pacote de controle das CIs, comentários na agenda, central de notificações e ritmo do dia.",
    itens: [
      it(18, "novidade", "Comunicação Interna", "CI concluída fica somente leitura. Comentário já na abertura da CI. Botão \"Acompanhar\" e filtro \"Acompanhamento\" para Admin/VIP."),
      it(19, "novidade", "Comunicação Interna", "Alerta sem interação mostra quem está ausente e tem \"Interação considerada\" com prazo. O criador recebe alertas repetidos, e após 3 alertas o pedido é escalonado."),
      it(20, "novidade", "Agenda", "Comentários nos feedbacks da agenda direto pelo sino, com os cards da agenda em azul."),
      it(21, "novidade", "Notificações", "\"Ver mais\" no sino e o módulo Notificações, com filtros por leitura, tipo e texto."),
      it(22, "novidade", "Desempenho", "Impacto progressivo de atrasos e pendências no índice, fotos do índice a cada 15 min, aviso de mudança relevante e relatório \"Ritmo do dia\" com fechamento diário."),
    ],
  },
  {
    id: "v_3_0_0", versao: "3.0.0", data: "2026-10-28", hora: "04:44",
    titulo: "Desempenho v3",
    resumo: "Base desta série: painel de impacto, Índice de Desempenho e visão de equipe.",
    itens: [
      it(23, "novidade", "Desempenho", "Índice de Desempenho 0–100 por pilares, fila do dia e visão da equipe (ranking, alertas e mapa de calor)."),
    ],
  },
];

export function versoesEfetivas(config) {
  const v = config && config.corp_versoes_sistema;
  return Array.isArray(v) ? v : VERSOES_INICIAIS;
}

function partesVersao(v) {
  return String(v || "0").split(".").map((x) => parseInt(x, 10) || 0);
}
export function compararVersoes(a, b) {
  const pa = partesVersao(a), pb = partesVersao(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
// Mais nova primeiro (por data/hora e, empatado, pelo número da versão).
export function ordenarVersoes(lista) {
  return [...(lista || [])].sort((a, b) => String(b.data + (b.hora || "")).localeCompare(String(a.data + (a.hora || ""))) || compararVersoes(b.versao, a.versao));
}
export function versaoAtual(config) {
  const l = ordenarVersoes(versoesEfetivas(config));
  return l.length ? l[0].versao : null;
}
// Sugestão pro próximo número: "melhoria"/"correção" só → patch; com novidade → minor.
export function sugerirProximaVersao(lista, temNovidade) {
  const ult = [...(lista || [])].sort((a, b) => compararVersoes(b.versao, a.versao))[0];
  const [ma, mi, pa] = ult ? partesVersao(ult.versao) : [3, 0, 0];
  return temNovidade ? `${ma}.${(mi || 0) + 1}.0` : `${ma}.${mi || 0}.${(pa || 0) + 1}`;
}

export function contarPorTipo(versoes) {
  const c = { novidade: 0, melhoria: 0, correcao: 0 };
  (versoes || []).forEach((v) => (v.itens || []).forEach((i) => { c[i.tipo] = (c[i.tipo] || 0) + 1; }));
  return c;
}

// ---------- relatório visual ----------
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}
function dataBR(iso) {
  const [y, m, d] = String(iso || "").split("-");
  return d && m ? `${d}/${m}/${y}` : "";
}
function dataExtenso(iso) {
  const d = new Date(String(iso) + "T12:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function montarHtmlRelatorioVersoes(versoes, { titulo = "Atualizações do Sinistro360", empresa = "", geradoPor = "" } = {}) {
  const lista = ordenarVersoes(versoes);
  const cont = contarPorTipo(lista);
  const total = cont.novidade + cont.melhoria + cont.correcao;
  const modulos = {};
  lista.forEach((v) => (v.itens || []).forEach((i) => { modulos[i.modulo || "Geral"] = (modulos[i.modulo || "Geral"] || 0) + 1; }));
  const topModulos = Object.entries(modulos).sort((a, b) => b[1] - a[1]);
  const maxMod = topModulos.length ? topModulos[0][1] : 1;
  const datas = lista.map((v) => v.data).filter(Boolean).sort();
  const periodo = datas.length ? (datas[0] === datas[datas.length - 1] ? dataExtenso(datas[0]) : `${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}`) : "";
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  // Rosca (novidade / melhoria / correção) em SVG puro.
  let acum = 0;
  const C = 2 * Math.PI * 42;
  const arcos = TIPOS_MUDANCA.map((t) => {
    const frac = total ? cont[t.key] / total : 0;
    const arco = `<circle cx="60" cy="60" r="42" fill="none" stroke="${t.cor}" stroke-width="16" stroke-dasharray="${(frac * C).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acum * C).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
    acum += frac;
    return arco;
  }).join("");

  const blocosVersao = lista.map((v, idx) => {
    const c = contarPorTipo([v]);
    const porModulo = {};
    (v.itens || []).forEach((i) => { (porModulo[i.modulo || "Geral"] = porModulo[i.modulo || "Geral"] || []).push(i); });
    const grupos = Object.entries(porModulo).map(([mod, itens]) => `
      <div class="mod">
        <div class="mod-nome">${esc(mod)}</div>
        ${itens.map((i) => { const t = tipoMudanca(i.tipo); return `<div class="item"><span class="tag" style="--c:${t.cor}">${t.icone} ${t.label}</span><span>${esc(i.texto)}</span></div>`; }).join("")}
      </div>`).join("");
    return `
    <section class="versao${idx === 0 ? " atual" : ""}">
      <div class="marco"><span></span></div>
      <div class="versao-corpo">
        <div class="versao-topo">
          <span class="num">v${esc(v.versao)}</span>
          ${idx === 0 ? '<span class="selo">MAIS RECENTE</span>' : ""}
          <span class="quando">${dataBR(v.data)}${v.hora ? " • " + esc(v.hora) : ""}</span>
        </div>
        <h2>${esc(v.titulo || "Atualização")}</h2>
        ${v.resumo ? `<p class="resumo">${esc(v.resumo)}</p>` : ""}
        <div class="mini">${TIPOS_MUDANCA.filter((t) => c[t.key]).map((t) => `<span style="--c:${t.cor}">${t.icone} ${c[t.key]} ${c[t.key] > 1 ? t.plural : t.label.toLowerCase()}</span>`).join("")}</div>
        ${grupos}
      </div>
    </section>`;
  }).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<style>
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"Segoe UI",Inter,Roboto,Arial,sans-serif;color:#0f172a;background:#eef2f9}
.pagina{max-width:900px;margin:0 auto;padding:28px 22px 40px}
.capa{position:relative;overflow:hidden;border-radius:22px;padding:34px 34px 30px;color:#fff;
  background:radial-gradient(circle at 85% 15%,rgba(124,58,237,.55),transparent 45%),linear-gradient(135deg,#0b1f4d 0%,#1e3a8a 55%,#2f6bff 100%)}
.capa:after{content:"";position:absolute;right:-60px;bottom:-60px;width:240px;height:240px;border-radius:50%;border:28px solid rgba(255,255,255,.07)}
.capa .marca{font-size:12px;letter-spacing:.22em;text-transform:uppercase;opacity:.8;font-weight:700}
.capa h1{font-size:34px;line-height:1.1;margin:10px 0 6px;letter-spacing:-.01em}
.capa .sub{opacity:.85;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}
.kpi{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:12px 14px}
.kpi b{display:block;font-size:30px;line-height:1}
.kpi span{font-size:11.5px;opacity:.85;text-transform:uppercase;letter-spacing:.06em}
.painel{display:grid;grid-template-columns:200px 1fr;gap:18px;margin:18px 0 8px}
.cartao{background:#fff;border-radius:18px;padding:18px;box-shadow:0 6px 24px rgba(15,23,42,.07)}
.cartao h3{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#475569}
.rosca{display:flex;flex-direction:column;align-items:center;gap:10px}
.rosca-centro{font-size:22px;font-weight:800;fill:#0f172a}
.legenda{display:flex;flex-direction:column;gap:5px;font-size:12.5px;width:100%}
.legenda i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:middle}
.barras{display:flex;flex-direction:column;gap:8px}
.barra{display:grid;grid-template-columns:150px 1fr 26px;gap:10px;align-items:center;font-size:12.5px}
.barra .trilho{height:10px;border-radius:99px;background:#e2e8f0;overflow:hidden}
.barra .trilho div{height:100%;border-radius:99px;background:linear-gradient(90deg,#2f6bff,#7c3aed)}
.barra b{text-align:right}
.linha-tempo{position:relative;margin-top:22px}
.versao{display:grid;grid-template-columns:34px 1fr;gap:10px;break-inside:avoid;page-break-inside:avoid}
.marco{position:relative}
.marco:before{content:"";position:absolute;left:16px;top:0;bottom:0;width:2px;background:#cbd5e1}
.versao:last-child .marco:before{bottom:auto;height:22px}
.marco span{position:absolute;left:9px;top:18px;width:16px;height:16px;border-radius:50%;background:#fff;border:4px solid #2f6bff}
.versao.atual .marco span{border-color:#7c3aed;box-shadow:0 0 0 5px rgba(124,58,237,.18)}
.versao-corpo{background:#fff;border-radius:18px;padding:18px 20px;margin-bottom:14px;box-shadow:0 6px 24px rgba(15,23,42,.07)}
.versao.atual .versao-corpo{border:2px solid rgba(124,58,237,.35)}
.versao-topo{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.num{font-weight:800;font-size:13px;color:#fff;background:#1e3a8a;border-radius:8px;padding:3px 9px;font-family:Consolas,monospace}
.selo{font-size:10.5px;font-weight:800;letter-spacing:.08em;color:#7c3aed;background:rgba(124,58,237,.12);border-radius:99px;padding:3px 9px}
.quando{margin-left:auto;font-size:12px;color:#64748b}
.versao h2{font-size:19px;margin:10px 0 4px}
.resumo{margin:0 0 10px;color:#475569;font-size:13.5px}
.mini{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.mini span{font-size:11.5px;font-weight:700;color:var(--c);background:color-mix(in srgb,var(--c) 12%,#fff);border-radius:99px;padding:3px 9px}
.mod{margin-top:10px}
.mod-nome{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#1e3a8a;margin-bottom:6px}
.item{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:13.5px;line-height:1.45;padding:7px 0;border-top:1px dashed #e2e8f0}
.tag{white-space:nowrap;font-size:11px;font-weight:800;color:#fff;background:var(--c);border-radius:6px;padding:2px 7px;margin-top:1px}
.rodape{text-align:center;color:#64748b;font-size:11.5px;margin-top:22px}
@media (max-width:640px){.kpis{grid-template-columns:repeat(2,1fr)}.painel{grid-template-columns:1fr}.barra{grid-template-columns:110px 1fr 22px}}
@media print{body{background:#fff}.pagina{padding:0}.cartao,.versao-corpo{box-shadow:none;border:1px solid #e2e8f0}@page{margin:12mm}}
</style></head><body><div class="pagina">
<div class="capa">
  <div class="marca">${esc(empresa ? empresa + " • " : "")}Sinistro360</div>
  <h1>${esc(titulo)}</h1>
  <div class="sub">${esc(periodo)}${lista.length ? ` • versão atual v${esc(lista[0].versao)}` : ""}</div>
  <div class="kpis">
    <div class="kpi"><b>${lista.length}</b><span>versões</span></div>
    <div class="kpi"><b>${cont.novidade}</b><span>novidades</span></div>
    <div class="kpi"><b>${cont.melhoria}</b><span>melhorias</span></div>
    <div class="kpi"><b>${cont.correcao}</b><span>correções</span></div>
  </div>
</div>
<div class="painel">
  <div class="cartao rosca">
    <h3>Tipo de mudança</h3>
    <svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label="Distribuição por tipo de mudança">
      <circle cx="60" cy="60" r="42" fill="none" stroke="#e2e8f0" stroke-width="16"/>${arcos}
      <text x="60" y="66" text-anchor="middle" class="rosca-centro">${total}</text>
    </svg>
    <div class="legenda">${TIPOS_MUDANCA.map((t) => `<div><i style="background:${t.cor}"></i>${t.label}: <b>${cont[t.key]}</b> (${pct(cont[t.key])}%)</div>`).join("")}</div>
  </div>
  <div class="cartao">
    <h3>Mudanças por módulo</h3>
    <div class="barras">${topModulos.map(([m, n]) => `<div class="barra"><span>${esc(m)}</span><div class="trilho"><div style="width:${Math.max(6, Math.round((n / maxMod) * 100))}%"></div></div><b>${n}</b></div>`).join("") || "<span>—</span>"}</div>
  </div>
</div>
<div class="linha-tempo">${blocosVersao || '<div class="cartao">Nenhuma versão no período.</div>'}</div>
<div class="rodape">Gerado em ${new Date().toLocaleString("pt-BR")}${geradoPor ? " por " + esc(geradoPor) : ""} • Sinistro360</div>
</div></body></html>`;
}
