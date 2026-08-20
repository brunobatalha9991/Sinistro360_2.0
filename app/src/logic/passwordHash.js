// Hash de senha usando a Web Crypto API nativa do navegador (sem dependência
// nova) — PBKDF2-SHA256 com sal único por usuário e muitas iterações.
//
// Importante: como o sistema não tem servidor (é um site estático que fala
// direto com o Firestore), a verificação da senha sempre vai acontecer no
// navegador — isso é uma limitação da arquitetura, não algo que o hash
// resolve sozinho. O que o hash resolve é: se alguém ler a coleção de
// usuários direto no banco (bypassando a tela de login), não encontra mais
// a senha de ninguém em texto puro, só um valor derivado que não dá pra usar
// diretamente para logar em nenhum lugar.
const ITERATIONS = 150000;
const HASH_BITS = 256;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export function randomSaltHex() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function deriveHashHex(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    HASH_BITS
  );
  return toHex(bits);
}

// Gera {senhaSalt, senhaHash} prontos para gravar no usuário.
export async function hashNewPassword(password) {
  const senhaSalt = randomSaltHex();
  const senhaHash = await deriveHashHex(password, senhaSalt);
  return { senhaSalt, senhaHash };
}

// Confere uma senha digitada contra o hash+sal já salvos.
export async function verifyPassword(password, senhaSalt, senhaHash) {
  const computed = await deriveHashHex(password, senhaSalt);
  return computed === senhaHash;
}
