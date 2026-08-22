import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "./useAuth";
import { isAdmin } from "../data/auth";
import { construirMemoria, memoriasAtivasParaUsuario } from "../logic/memoriaIA";

// Memória controlada do Assistente IA (Fase 6). Criar é uma ação humana
// explícita (nunca o modelo decidindo sozinho); aprovar memória de
// equipe/organizacional exige admin — mesmo padrão de permissão usado no
// resto do app (isAdmin, ver data/auth.js).
export function useIaMemoria() {
  const { records, saveRecord } = useData();
  const { currentUser } = useAuth();
  const memorias = records.corp_ai_memorias || [];

  function criarMemoria({ escopo, conteudo, tipo, equipeGrupo, dataExpiracao }) {
    if (!currentUser || !conteudo || !conteudo.trim()) return null;
    const nova = construirMemoria({ escopo, conteudo: conteudo.trim(), tipo, criadoPorUserId: currentUser.id, equipeGrupo, dataExpiracao });
    saveRecord("corp_ai_memorias", (current) => [...(current || []), nova]);
    return nova;
  }

  function mudarStatus(id, status) {
    if (!isAdmin(currentUser)) return;
    saveRecord("corp_ai_memorias", (current) => (current || []).map((m) => (
      m.id === id ? { ...m, status, aprovadoPor: currentUser.id, updatedAt: new Date().toISOString() } : m
    )));
  }

  return {
    memorias,
    memoriasAtivas: memoriasAtivasParaUsuario(memorias, currentUser),
    criarMemoria,
    aprovarMemoria: (id) => mudarStatus(id, "aprovado"),
    rejeitarMemoria: (id) => mudarStatus(id, "rejeitado"),
    expirarMemoria: (id) => mudarStatus(id, "expirado"),
  };
}
