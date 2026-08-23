// Regras de "mover pra pasta" (rótulos do Gmail) — a pedido do usuário.
// Função pura: só decide se um e-mail bate com uma regra; quem aplica de
// verdade (chamar a API pra mover) fica em Emails.jsx.
export function avaliarRegra(email, regra) {
  if (!regra || !regra.valor) return false;
  const campo = regra.campo === "remetente"
    ? `${email.remetenteNome || ""} ${email.remetente || ""}`
    : regra.campo === "assunto"
      ? email.assunto || ""
      : email.corpoTexto || "";
  return campo.toLowerCase().indexOf(String(regra.valor).trim().toLowerCase()) >= 0;
}

// Primeira regra (na ordem cadastrada) que bater com o e-mail, ou null.
export function encontrarRegraAplicavel(email, regras) {
  return (regras || []).find((r) => avaliarRegra(email, r)) || null;
}
