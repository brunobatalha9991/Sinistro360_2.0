import { fmtDateBR, isoFromBR, todayISO, uid } from "./format";

// Porte 1:1 das funções de CSV/importação de histórico em lote do HTML original.
export function csvField(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }

export function downloadCSV(filename, rows) {
  const lines = rows.map((r) => r.map(csvField).join(";"));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function parseCSVSemi(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  text = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ";") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function downloadHistoricoTemplate(claims) {
  const header = ["Nosso N°", "Tipo", "Segurado/Terceiro", "N° Sinistro", "Últ. Histórico"];
  const rows = [header].concat(claims.map((c) => [c.nosnum || "", c.tipo || "", c.segurado || "", c.numsin || "", ""]));
  downloadCSV("modelo_historico.csv", rows);
}

export function parseHistoricoCell(v) {
  const raw = String(v || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{2}\/\d{2}\/\d{4})\s*:\s*([\s\S]*)$/);
  if (m) {
    const iso = isoFromBR(m[1]);
    if (iso) return { date: iso, dateBR: m[1], text: m[2].trim(), dataInferida: false };
  }
  const hoje = todayISO();
  return { date: hoje, dateBR: fmtDateBR(hoje), text: raw, dataInferida: true };
}

export function findClaimForHistoricoRow(claims, row) {
  const nosnum = String(row.nosnum || "").trim(), tipo = String(row.tipo || "").trim();
  const segurado = String(row.segurado || "").trim().toUpperCase(), numsin = String(row.numsin || "").trim();
  return claims.filter((c) => (
    String(c.nosnum || "").trim() === nosnum &&
    String(c.tipo || "").trim() === tipo &&
    String(c.segurado || "").trim().toUpperCase() === segurado &&
    String(c.numsin || "").trim() === numsin
  ));
}

// Processa o texto do CSV já lido e devolve {ok, falha, report} — quem chama
// decide como persistir cada comentário/auditoria (via useOverrideActions).
export function processHistoricoCsv(text, claims, currentUserName, saveCommentForClaim) {
  const rows = parseCSVSemi(text);
  if (!rows.length) return null;
  rows.shift();
  const report = [["Nosso N°", "Tipo", "Segurado/Terceiro", "N° Sinistro", "Últ. Histórico (original)", "Status", "Data registrada", "Descrição registrada"]];
  let ok = 0, falha = 0;
  rows.forEach((cols) => {
    const row = { nosnum: cols[0], tipo: cols[1], segurado: cols[2], numsin: cols[3] };
    const cel = cols[4] || "";
    if (!row.nosnum && !row.tipo && !row.segurado && !row.numsin && !cel) return;
    const parsed = parseHistoricoCell(cel);
    if (!parsed) {
      falha++;
      report.push([row.nosnum, row.tipo, row.segurado, row.numsin, cel, "Sem conteúdo — ignorado", "", ""]);
      return;
    }
    const matches = findClaimForHistoricoRow(claims, row);
    if (matches.length === 0) {
      falha++;
      report.push([row.nosnum, row.tipo, row.segurado, row.numsin, cel, "Não encontrado no sistema", "", ""]);
      return;
    }
    if (matches.length > 1) {
      falha++;
      report.push([row.nosnum, row.tipo, row.segurado, row.numsin, cel, `Ambíguo (${matches.length} processos coincidem)`, "", ""]);
      return;
    }
    const claim = matches[0];
    saveCommentForClaim(claim.id, {
      id: "cm_" + uid(), canal: "Dados importado", meio: "Dados importado", date: parsed.date, text: parsed.text,
      who: currentUserName || "—", at: new Date().toISOString(),
    });
    ok++;
    report.push([row.nosnum, row.tipo, row.segurado, row.numsin, cel,
      parsed.dataInferida ? "OK — importado (sem data válida na célula: usada a data da importação)" : "OK — importado",
      parsed.dateBR, parsed.text]);
  });
  return { ok, falha, report };
}

// Modelo/importação de Próxima ação em lote — mesma lógica de casamento de
// processo do histórico (Nosso N°/Tipo/Segurado/N° Sinistro), mas com
// título e data em colunas separadas (a pedido do usuário: diferente do
// histórico, aqui não é "data: texto" numa célula só). NÃO sobrescreve: só
// preenche processos que ainda não têm nenhuma Próxima ação definida — se
// já tiver uma (mesmo vazio o resto da planilha), a linha é ignorada e o
// processo fica intacto (a pedido do usuário). Data em branco é válida —
// vira "Sem prazo", igual à edição manual na tela.
export function downloadProximaAcaoTemplate(claims) {
  const header = ["Nosso N°", "Tipo", "Segurado/Terceiro", "N° Sinistro", "Próxima Ação", "Data (DD/MM/AAAA)"];
  const rows = [header].concat(claims.map((c) => [c.nosnum || "", c.tipo || "", c.segurado || "", c.numsin || "", "", ""]));
  downloadCSV("modelo_proxima_acao.csv", rows);
}

export function processProximaAcaoCsv(text, claims, overrides, getNextActionForClaim, saveNextActionForClaim) {
  const rows = parseCSVSemi(text);
  if (!rows.length) return null;
  rows.shift();
  const report = [["Nosso N°", "Tipo", "Segurado/Terceiro", "N° Sinistro", "Próxima Ação (original)", "Data (original)", "Status", "Prazo registrado", "Título registrado"]];
  let ok = 0, ignorados = 0, falha = 0;
  rows.forEach((cols) => {
    const row = { nosnum: cols[0], tipo: cols[1], segurado: cols[2], numsin: cols[3] };
    const titulo = String(cols[4] || "").trim();
    const dataCel = String(cols[5] || "").trim();
    if (!row.nosnum && !row.tipo && !row.segurado && !row.numsin && !titulo && !dataCel) return;
    if (!titulo) {
      falha++;
      report.push([row.nosnum, row.tipo, row.segurado, row.numsin, titulo, dataCel, "Sem título — ignorado", "", ""]);
      return;
    }
    const iso = dataCel ? isoFromBR(dataCel) : "";
    if (dataCel && !iso) {
      falha++;
      report.push([row.nosnum, row.tipo, row.segurado, row.numsin, titulo, dataCel, "Data inválida — ignorado", "", ""]);
      return;
    }
    const matches = findClaimForHistoricoRow(claims, row);
    if (matches.length === 0) {
      falha++;
      report.push([row.nosnum, row.tipo, row.segurado, row.numsin, titulo, dataCel, "Não encontrado no sistema", "", ""]);
      return;
    }
    if (matches.length > 1) {
      falha++;
      report.push([row.nosnum, row.tipo, row.segurado, row.numsin, titulo, dataCel, `Ambíguo (${matches.length} processos coincidem)`, "", ""]);
      return;
    }
    const claim = matches[0];
    const atual = getNextActionForClaim(overrides, claim.id);
    if (atual && atual.title) {
      ignorados++;
      report.push([row.nosnum, row.tipo, row.segurado, row.numsin, titulo, dataCel, "Ignorado — processo já tem Próxima ação definida", "", ""]);
      return;
    }
    saveNextActionForClaim(claim.id, { title: titulo, date: iso || "", origem: "importado" });
    ok++;
    report.push([row.nosnum, row.tipo, row.segurado, row.numsin, titulo, dataCel, "OK — importado", iso ? fmtDateBR(iso) : "Sem prazo", titulo]);
  });
  return { ok, ignorados, falha, report };
}
