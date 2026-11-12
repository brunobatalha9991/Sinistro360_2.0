// Marcações com "@" nos comentários das CIs (a pedido do usuário): digitar
// "@" abre a lista de usuários; o comentário com marcação fica destacado e
// cada marcado recebe uma notificação (tipo "mencao"). O comentário guarda
// os ids em `mencoes`.
//
// A marcação no texto é "@Nome Completo" (o que a lista insere). Digitada à
// mão, também vale "@PrimeiroNome" quando só um usuário tem esse primeiro
// nome. Comparação sem acento e sem maiúsculas.

// Minúsculas sem acento, caractere a caractere — mantém o mesmo tamanho do
// texto original, pra as posições servirem pros dois.
function dobrar(s) {
  return Array.from(String(s || ""), (c) => {
    const base = c.normalize("NFD")[0] || c;
    const low = base.toLowerCase();
    return low.length === c.length ? low : c;
  }).join("");
}

function ehLetra(c) {
  return !!c && /[\p{L}\p{N}]/u.test(c);
}

// Rótulos que marcam cada usuário: nome completo e, se for único, o
// primeiro nome. Mais longos primeiro (o nome completo ganha do primeiro).
function rotulos(users) {
  const lista = (users || []).filter((u) => u && u.id && String(u.nome || "").trim());
  const contaPrimeiro = {};
  lista.forEach((u) => {
    const p = dobrar(String(u.nome).trim().split(/\s+/)[0]);
    contaPrimeiro[p] = (contaPrimeiro[p] || 0) + 1;
  });
  const out = [];
  lista.forEach((u) => {
    const nome = String(u.nome).trim().replace(/\s+/g, " ");
    out.push({ userId: u.id, chave: dobrar(nome) });
    const primeiro = dobrar(nome.split(" ")[0]);
    if (primeiro !== dobrar(nome) && contaPrimeiro[primeiro] === 1) out.push({ userId: u.id, chave: primeiro });
  });
  return out.sort((a, b) => b.chave.length - a.chave.length);
}

// Trechos do texto: [{ texto, userId? }] — userId nos trechos "@Nome".
export function partesComMencoes(texto, users) {
  const s = String(texto || "");
  if (s.indexOf("@") < 0) return [{ texto: s }];
  const d = dobrar(s);
  const rs = rotulos(users);
  const partes = [];
  let ini = 0;
  let i = 0;
  while (i < s.length) {
    if (s[i] === "@" && !ehLetra(s[i - 1])) {
      const r = rs.find((x) => d.startsWith(x.chave, i + 1) && !ehLetra(s[i + 1 + x.chave.length]));
      if (r) {
        if (i > ini) partes.push({ texto: s.slice(ini, i) });
        const fim = i + 1 + r.chave.length;
        partes.push({ texto: s.slice(i, fim), userId: r.userId });
        ini = fim;
        i = fim;
        continue;
      }
    }
    i++;
  }
  if (ini < s.length) partes.push({ texto: s.slice(ini) });
  return partes;
}

// Ids marcados no texto, sem repetir, na ordem em que aparecem.
export function mencoesNoTexto(texto, users) {
  const ids = [];
  partesComMencoes(texto, users).forEach((p) => { if (p.userId && !ids.includes(p.userId)) ids.push(p.userId); });
  return ids;
}

// Marcação sendo digitada: o "@" antes do cursor (no começo ou depois de
// espaço) e o que já foi digitado depois dele. null = nenhuma.
export function mencaoEmDigitacao(texto, cursor) {
  const s = String(texto || "").slice(0, cursor == null ? undefined : cursor);
  const at = s.lastIndexOf("@");
  if (at < 0 || ehLetra(s[at - 1])) return null;
  const termo = s.slice(at + 1);
  if (termo.length > 40 || /[\n@]/.test(termo) || /\s\s/.test(termo) || /^\s/.test(termo)) return null;
  return { inicio: at, termo };
}

// Usuários sugeridos pro termo digitado: nome (ou um dos sobrenomes)
// começando pelo termo. Termo vazio = todos.
export function sugestoesMencao(termo, users, excetoId, limite = 8) {
  const t = dobrar(String(termo || "").trim());
  return (users || [])
    .filter((u) => u && u.id && u.id !== excetoId && String(u.nome || "").trim())
    .filter((u) => {
      if (!t) return true;
      const n = dobrar(String(u.nome).trim().replace(/\s+/g, " "));
      return n.startsWith(t) || n.split(" ").some((w) => w.startsWith(t));
    })
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
    .slice(0, limite);
}

// Texto com a marcação escolhida no lugar do "@termo" e a posição do cursor
// logo depois dela.
export function inserirMencao(texto, cursor, mencao, user) {
  const s = String(texto || "");
  const fimTermo = cursor == null ? s.length : cursor;
  const rotulo = "@" + String(user.nome || "").trim().replace(/\s+/g, " ") + " ";
  const novo = s.slice(0, mencao.inicio) + rotulo + s.slice(fimTermo).replace(/^ /, "");
  return { texto: novo, cursor: mencao.inicio + rotulo.length };
}
