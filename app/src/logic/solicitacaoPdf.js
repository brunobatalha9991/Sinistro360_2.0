import { getFormularioEfetivo, secaoRepetivel, TIPOS_ATENDIMENTO } from "./solicitacaoAtendimento";
import { fmtDateHoraBR } from "./format";

// Exportação em PDF do formulário de Solicitação de Atendimento (Mesa de
// Atendimento, botão "Solicitação" do modal de Comunicação interna) — a
// pedido do usuário. Mesma filosofia do resto do app (Dashboard e
// Relatórios): o PDF é gerado pelo próprio navegador, vetorial, sem
// biblioteca nova. Como o formulário vive dentro de um modal, em vez de
// imprimir a página inteira montamos um documento HTML só com o formulário
// preenchido (montarHtmlSolicitacao) e imprimimos esse documento num
// iframe oculto (imprimirHtml) — assim o resto da tela não entra no papel.

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escMultilinha(s) {
  return esc(s).replace(/\n/g, "<br>");
}

export function labelTipoAtendimento(tipoAtendimento) {
  const par = TIPOS_ATENDIMENTO.find(([k]) => k === tipoAtendimento);
  return par ? par[1] : tipoAtendimento || "";
}

// Valor de um campo como texto pronto pra impressão. Arquivos viram a
// lista de nomes (com link, quando houver) — o PDF não embute o anexo em
// si, só referencia onde ele está no Drive.
export function formatarValorCampo(campo, valor) {
  if (campo.tipo === "arquivo") {
    const lista = Array.isArray(valor) ? valor : [];
    if (!lista.length) return { vazio: true, html: "—" };
    return {
      vazio: false,
      html: lista.map((a) => (a && a.url ? `<a href="${esc(a.url)}">${esc(a.nome || a.url)}</a>` : esc((a && a.nome) || ""))).filter(Boolean).join("<br>"),
    };
  }
  const t = String(valor == null ? "" : valor).trim();
  if (!t) return { vazio: true, html: "—" };
  if (campo.tipo === "datahora") {
    const d = new Date(t);
    return { vazio: false, html: esc(isNaN(d.getTime()) ? t : fmtDateHoraBR(d.toISOString())) };
  }
  if (campo.tipo === "textarea") return { vazio: false, html: escMultilinha(t) };
  return { vazio: false, html: esc(t) };
}

function linhasDaSecao(campos, valores) {
  return campos.map((campo) => {
    const f = formatarValorCampo(campo, (valores || {})[campo.id]);
    return `<tr><th>${esc(campo.label)}${campo.obrigatorio ? " *" : ""}</th><td class="${f.vazio ? "vazio" : ""}">${f.html}</td></tr>`;
  }).join("");
}

// Estrutura (seções → campos → valor formatado) usada tanto pelo HTML
// quanto pelos testes. Respeita a regra de seção condicional do formulário
// (ex.: "Dados do Terceiro" só quando o atendimento envolve terceiro) e a
// seção repetível (terceiros extras).
export function estruturarSolicitacao(tipoAtendimento, valores, config) {
  const def = getFormularioEfetivo(tipoAtendimento, config);
  if (!def) return null;
  const v = valores || {};
  const secoes = [];
  def.campos.forEach((c) => { if (c.secao && secoes.indexOf(c.secao) < 0) secoes.push(c.secao); });
  const blocos = [];
  secoes.forEach((secao) => {
    if (def.secaoVisivel && !def.secaoVisivel(secao, v)) return;
    const campos = def.campos.filter((c) => c.secao === secao);
    blocos.push({ titulo: secao, campos, valores: v });
    if (secaoRepetivel(tipoAtendimento, secao)) {
      (v.terceirosExtra || []).forEach((entrada, idx) => {
        blocos.push({ titulo: `${secao} — Terceiro #${idx + 2}`, campos, valores: entrada || {} });
      });
    }
  });
  return { titulo: def.titulo, blocos };
}

// `contexto` (opcional): { tituloTarefa, processoLabel, solicitante, geradoPor }
export function montarHtmlSolicitacao({ tipoAtendimento, valores, config, contexto }) {
  const estrutura = estruturarSolicitacao(tipoAtendimento, valores, config);
  const ctx = contexto || {};
  const geradoEm = fmtDateHoraBR(new Date().toISOString());
  const tituloDoc = estrutura ? estrutura.titulo : "Solicitação de Atendimento";

  const meta = [
    ["Tipo de atendimento", labelTipoAtendimento(tipoAtendimento)],
    ["Tarefa", ctx.tituloTarefa],
    ["Processo vinculado", ctx.processoLabel],
    ["Solicitante", ctx.solicitante],
    ["Gerado em", geradoEm + (ctx.geradoPor ? ` por ${ctx.geradoPor}` : "")],
  ].filter(([, val]) => val && String(val).trim());

  const corpo = !estrutura
    ? `<p class="aviso">O formulário de solicitação para este tipo de atendimento ainda não foi configurado no sistema.</p>`
    : estrutura.blocos.map((b) => `
      <section>
        <h2>${esc(b.titulo)}</h2>
        <table>${linhasDaSecao(b.campos, b.valores)}</table>
      </section>`).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(tituloDoc)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font: 11.5px/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; background: #fff; }
  header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; }
  header h1 { font-size: 17px; margin: 0 0 6px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; font-size: 10.5px; color: #334155; }
  .meta b { color: #0f172a; }
  section { margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #1d4ed8; background: #eff6ff; padding: 5px 8px; margin: 0 0 4px; border-left: 3px solid #1d4ed8; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  th { width: 38%; font-weight: 600; color: #334155; background: #f8fafc; }
  td.vazio { color: #94a3b8; }
  td a { color: #1d4ed8; text-decoration: none; word-break: break-all; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .aviso { color: #b45309; }
  footer { margin-top: 18px; font-size: 9.5px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; }
</style>
</head>
<body>
  <header>
    <h1>${esc(tituloDoc)}</h1>
    <div class="meta">${meta.map(([k, val]) => `<div><b>${esc(k)}:</b> ${esc(val)}</div>`).join("")}</div>
  </header>
  ${corpo}
  <footer>Sinistro360 — Solicitação de Atendimento. Campos marcados com * são obrigatórios; "—" indica campo não preenchido. Anexos ficam no Google Drive (links acima).</footer>
</body>
</html>`;
}

// Imprime um documento HTML completo num iframe oculto (o diálogo de
// impressão do navegador permite "Salvar como PDF"). Iframe em vez de
// window.open pra não cair em bloqueador de pop-up; o iframe é removido
// depois que o diálogo fecha.
export function imprimirHtml(html) {
  if (typeof document === "undefined") return false;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) { iframe.remove(); return false; }
  let removido = false;
  function limpar() { if (removido) return; removido = true; setTimeout(() => iframe.remove(), 500); }
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.addEventListener("afterprint", limpar);
    // Dá tempo do documento renderizar antes de abrir o diálogo.
    setTimeout(() => {
      try { win.focus(); win.print(); } catch { limpar(); return; }
      // Navegadores que não disparam afterprint: limpa depois de um tempo
      // generoso (o diálogo já capturou o conteúdo a essa altura).
      setTimeout(limpar, 60000);
    }, 250);
    return true;
  } catch {
    limpar();
    return false;
  }
}
