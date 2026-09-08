// pdfjs-dist (~500 KB minificado) é carregado sob demanda, só quando um PDF
// é realmente importado — a pedido do usuário: import estático deixava a
// biblioteca inteira dentro do chunk de Configurações, carregada por todo
// mundo que abre a tela, mesmo sem nunca usar este card.
let pdfjsLibPromise = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjsLib, workerUrlMod]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlMod.default;
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
}

// Marcadores gravados pelo formulário standalone (ver
// docs/Formulario-Abertura-Comercial.html) no rodapé da página impressa —
// têm que ser mantidos idênticos nos dois lados, já que o formulário roda
// fora do bundle do app (HTML solto, sem import possível deste módulo).
const MARK_START = "-----SINISTRO360-DADOS-INICIO-----";
const MARK_END = "-----SINISTRO360-DADOS-FIM-----";

function b64DecodeUnicode(str) {
  return decodeURIComponent(
    atob(str)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

// Extrai todo o texto de um PDF (todas as páginas, em ordem) — a pedido do
// usuário: o formulário comercial (HTML solto, impresso como PDF pelo
// navegador) grava os dados preenchidos como texto codificado no rodapé;
// aqui a gente lê esse texto de volta pra reconstruir o processo.
export async function extractPdfText(arrayBuffer) {
  const pdfjsLib = await loadPdfjs();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((it) => it.str).join("\n") + "\n";
  }
  return texto;
}

// Localiza o bloco entre os marcadores, remove qualquer espaço/quebra de
// linha inserida pela extração do PDF e decodifica de volta pro objeto
// original. Retorna { ok:false, error } quando o PDF não é (ou não é mais)
// um formulário comercial válido.
export function parseImportPayloadFromText(fullText) {
  const iStart = fullText.indexOf(MARK_START);
  const iEnd = fullText.indexOf(MARK_END);
  if (iStart < 0 || iEnd < 0 || iEnd < iStart) {
    return { ok: false, error: "Não foi possível localizar os dados de importação neste PDF. Confirme que ele foi exportado pelo Formulário de Abertura Comercial (docs/Formulario-Abertura-Comercial.html) e que o texto não foi editado/apagado." };
  }
  const bloco = fullText.slice(iStart + MARK_START.length, iEnd).replace(/\s+/g, "");
  if (!bloco) return { ok: false, error: "O bloco de dados do PDF está vazio." };

  let data;
  try {
    data = JSON.parse(b64DecodeUnicode(bloco));
  } catch {
    return { ok: false, error: "O bloco de dados do PDF está corrompido ou em formato inválido." };
  }
  if (!data || data._origem !== "sinistro360_formulario_comercial" || !String(data.segurado || "").trim()) {
    return { ok: false, error: "O PDF não contém um formulário de abertura comercial válido." };
  }
  return { ok: true, data };
}

export async function parseImportPayloadFromPdf(file) {
  const buf = await file.arrayBuffer();
  const texto = await extractPdfText(buf);
  return parseImportPayloadFromText(texto);
}
