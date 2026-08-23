import { campoEfetivo } from "./claims";

// Identificação de processo em e-mail — a pedido do usuário: em vez de
// tentar "extrair" um número de sinistro/placa do texto com regex (frágil,
// já que não há um formato fixo garantido vindo da API CORP), a lógica é a
// oposta e mais confiável: para cada processo já conhecido, verifica se o
// TEXTO do e-mail contém o nº de sinistro, a placa ou o nome do segurado
// daquele processo. Normaliza (maiúsculas, sem acento, só letras/números)
// pra não perder por causa de espaço/traço/acento diferente.
const DIACRITICOS = /[\u0300-\u036f]/g;
export function normalizarTexto(s) {
  return String(s || "")
    .toUpperCase()
    .normalize("NFD").replace(DIACRITICOS, "")
    .replace(/[^A-Z0-9]/g, "");
}

// Comprimento mínimo pra cada sinal contar — evita falso positivo com
// valores curtos/genéricos demais (ex.: um "numsin" de 2 dígitos).
const MIN_NUMSIN = 5;
const MIN_NOME = 6;

export function encontrarProcessosNoEmail(textoEmail, claims, overrides) {
  const alvo = normalizarTexto(textoEmail);
  if (!alvo) return [];
  const achados = [];
  (claims || []).forEach((c) => {
    const motivos = [];
    const numsin = normalizarTexto(campoEfetivo(overrides, c, "numsin"));
    const placa = normalizarTexto(campoEfetivo(overrides, c, "placa"));
    const segurado = normalizarTexto(campoEfetivo(overrides, c, "segurado"));
    if (numsin.length >= MIN_NUMSIN && alvo.indexOf(numsin) >= 0) motivos.push("numero_sinistro");
    if (placa.length === 7 && alvo.indexOf(placa) >= 0) motivos.push("placa");
    if (segurado.length >= MIN_NOME && alvo.indexOf(segurado) >= 0) motivos.push("nome");
    if (motivos.length) achados.push({ claimId: c.id, motivos });
  });
  return achados;
}

export const MOTIVO_LABEL = {
  numero_sinistro: "Nº de sinistro",
  placa: "Placa",
  nome: "Nome do segurado",
  manual: "Vínculo manual",
};
