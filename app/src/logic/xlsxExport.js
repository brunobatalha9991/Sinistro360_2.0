// Gera e baixa um .xlsx de verdade (Office Open XML), sem dependência nova:
// o arquivo é só um ZIP com meia dúzia de XMLs, então montamos o ZIP no modo
// "store" (sem compressão) aqui mesmo. Fica tudo na máquina do usuário, nada
// é enviado a lugar nenhum — igual ao exportCSV.
//
// columns: [{ label, width, type }] — type "date" (valor ISO yyyy-mm-dd vira
// data de verdade no Excel, ordenável/filtrável), "datetime" (timestamp ISO
// vira data+hora no fuso local), "number", "wrap" (texto longo com quebra
// de linha) ou omitido (texto simples).
// rows: array de arrays, na mesma ordem das colunas.

const enc = new TextEncoder();

// Caracteres de controle (exceto \t \n \r) são inválidos em XML e fazem o
// Excel recusar o arquivo inteiro como "corrompido".
function xmlEsc(v) {
  return String(v == null ? "" : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colLetter(i) {
  let s = "";
  i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

// Excel conta os dias a partir de 30/12/1899.
export function isoToExcelSerial(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.round((t - Date.UTC(1899, 11, 30)) / 86400000);
}

// Data+hora no fuso local de quem exporta (é o que a tela mostra).
export function isoToExcelSerialDateTime(iso) {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return isoToExcelSerial(iso);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return Math.round(((t - Date.UTC(1899, 11, 30)) / 86400000) * 1e6) / 1e6;
}

// Índices de estilo de styles.xml (cellXfs).
const S_HEADER = 1, S_DATE = 2, S_WRAP = 3, S_TEXT = 4, S_DATETIME = 5, S_NUMBER = 6;

function sheetXml(columns, rows) {
  const lastCol = colLetter(columns.length - 1);
  const lastRow = rows.length + 1;
  const cell = (ref, v, s) => {
    if (v == null || v === "") return `<c r="${ref}" s="${s}"/>`;
    return `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  };
  const head = `<row r="1">${columns.map((c, i) => cell(colLetter(i) + "1", c.label, S_HEADER)).join("")}</row>`;
  const body = rows.map((r, ri) => {
    const rn = ri + 2;
    return `<row r="${rn}">${columns.map((c, ci) => {
      const ref = colLetter(ci) + rn;
      const v = r[ci];
      if (c.type === "date" || c.type === "datetime") {
        const st = c.type === "date" ? S_DATE : S_DATETIME;
        const n = c.type === "date" ? isoToExcelSerial(v) : isoToExcelSerialDateTime(v);
        return n == null ? `<c r="${ref}" s="${st}"/>` : `<c r="${ref}" s="${st}"><v>${n}</v></c>`;
      }
      if (c.type === "number") {
        const n = typeof v === "number" ? v : v === "" || v == null ? NaN : Number(v);
        return isFinite(n) ? `<c r="${ref}" s="${S_NUMBER}"><v>${n}</v></c>` : cell(ref, v, S_TEXT);
      }
      return cell(ref, v, c.type === "wrap" ? S_WRAP : S_TEXT);
    }).join("")}</row>`;
  }).join("");
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 18}" customWidth="1"/>`).join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${cols}</cols><sheetData>${head}${body}</sheetData>`
    + `<autoFilter ref="A1:${lastCol}${lastRow}"/>`
    + "</worksheet>";
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
  + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="7">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>'
  + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>'
  + "</cellXfs>"
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
  + "</styleSheet>";

// Nome de aba: até 31 caracteres, sem : \ / ? * [ ]
function nomeAba(s) { return (String(s || "Planilha").replace(/[:\\/?*[\]]/g, " ").trim() || "Planilha").slice(0, 31); }

export function buildXlsxFiles({ sheetName, columns, rows }) {
  const aba = nomeAba(sheetName);
  const lastRef = `$A$1:$${colLetter(columns.length - 1)}$${rows.length + 1}`;
  return [
    ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + "</Types>"],
    ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + "</Relationships>"],
    ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + `<sheets><sheet name="${xmlEsc(aba)}" sheetId="1" r:id="rId1"/></sheets>`
      + `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xmlEsc(aba.replace(/'/g, "''"))}'!${lastRef}</definedName></definedNames>`
      + "</workbook>"],
    ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + "</Relationships>"],
    ["xl/styles.xml", STYLES],
    ["xl/worksheets/sheet1.xml", sheetXml(columns, rows)],
  ];
}

// ---- ZIP (modo store) -------------------------------------------------------
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipStore(files) {
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 01/01/1980
  const partes = [];
  const central = [];
  let offset = 0;
  files.forEach(([name, content]) => {
    const nome = enc.encode(name);
    const dados = typeof content === "string" ? enc.encode(content) : content;
    const crc = crc32(dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 0, true);      // store
    local.setUint16(10, 0, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true);
    local.setUint32(22, dados.length, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);
    partes.push(new Uint8Array(local.buffer), nome, dados);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true);
    cd.setUint16(14, DOS_DATE, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, dados.length, true);
    cd.setUint32(24, dados.length, true);
    cd.setUint16(28, nome.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nome);

    offset += 30 + nome.length + dados.length;
  });
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, files.length, true);
  fim.setUint16(10, files.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, offset, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadXlsx({ fileName, sheetName, columns, rows }) {
  const blob = zipStore(buildXlsxFiles({ sheetName, columns, rows }));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
