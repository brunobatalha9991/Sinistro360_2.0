// Memória controlada do Assistente IA — Fase 6 (IA Sinistros). Memórias
// NUNCA são criadas pelo próprio modelo a partir da conversa (isso seria
// "transformar uma opinião isolada em regra corporativa" automaticamente,
// exatamente o que o pedido original proíbe) — só por ação explícita do
// usuário na interface (ver components/ai/EnsinarAssistente.jsx).
//
// "Equipe" aqui não é uma entidade nova (a auditoria confirmou que não
// existe no sistema) — é o mapeamento de role já decidido com o usuário:
// admin/atendente = gestor, analista/consulta = equipe.
import { uid } from "./format";

export const ROLE_GRUPO = { admin: "gestor", atendente: "gestor", analista: "equipe", consulta: "equipe" };

export function grupoDoUsuario(user) { return user ? (ROLE_GRUPO[user.role] || "equipe") : "equipe"; }

export function memoriaExpirada(m, agoraISO) {
  return !!(m.dataExpiracao && String(m.dataExpiracao) < (agoraISO || new Date().toISOString()));
}

// Só memórias aprovadas, não expiradas, e dentro do escopo de quem pergunta.
export function memoriasAtivasParaUsuario(memorias, user, agoraISO) {
  const grupo = grupoDoUsuario(user);
  return (memorias || []).filter((m) => {
    if (m.status !== "aprovado") return false;
    if (memoriaExpirada(m, agoraISO)) return false;
    if (m.escopo === "pessoal") return !!user && m.usuarioId === user.id;
    if (m.escopo === "equipe") return m.equipeGrupo === grupo;
    return m.escopo === "organizacional";
  });
}

// Memória pessoal é autoaprovada (só afeta o próprio autor — nada corporativo
// sendo decidido). Equipe/organizacional nascem pendentes: só um admin pode
// aprovar (ver hooks/useIaMemoria.js).
export function construirMemoria({ escopo, conteudo, tipo, criadoPorUserId, equipeGrupo, dataExpiracao, agoraISO }) {
  const agora = agoraISO || new Date().toISOString();
  const autoAprovada = escopo === "pessoal";
  return {
    id: uid("mem"),
    escopo,
    usuarioId: escopo === "pessoal" ? criadoPorUserId : null,
    equipeGrupo: escopo === "equipe" ? (equipeGrupo || null) : null,
    tipo: tipo || "preferencia",
    conteudo,
    fonte: "usuário",
    confianca: "media",
    status: autoAprovada ? "aprovado" : "pendente_aprovacao",
    criadoPor: criadoPorUserId,
    aprovadoPor: autoAprovada ? criadoPorUserId : null,
    dataExpiracao: dataExpiracao || null,
    createdAt: agora,
    updatedAt: agora,
  };
}
