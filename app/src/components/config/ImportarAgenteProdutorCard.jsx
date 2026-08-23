import { useState } from "react";
import { isManualClaim } from "../../logic/claims";
import { fetchDocumento, normalizeAgenteProdutorSnapshot } from "../../logic/corpApi";

// Busca em lote o Agente/Produtor (endpoint /documento do CORP, vinculado
// por codfil+nosnum) de todos os processos sincronizados da API — a pedido
// do usuário, pra não depender de alguém abrir a Visão geral de cada
// processo um por um antes do filtro/vínculo por Agente-Produtor funcionar
// pra valer. Sequencial (não em paralelo) pra não sobrecarregar a API.
export function ImportarAgenteProdutorCard({ claims, config, actions, canEdit }) {
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState(null);

  async function importar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não importar dados."); return; }
    const alvo = (claims || []).filter((c) => !isManualClaim(c) && c.nosnum);
    if (!alvo.length) { alert("Nenhum processo sincronizado da API para buscar."); return; }
    if (!confirm(`Buscar Agente/Produtor de ${alvo.length} processo(s) agora? Pode levar alguns minutos.`)) return;

    setRodando(true);
    let ok = 0, semDados = 0, falha = 0;
    for (let i = 0; i < alvo.length; i++) {
      const c = alvo[i];
      setProgresso({ atual: i + 1, total: alvo.length });
      try {
        const resp = await fetchDocumento(config.corp_cfg || {}, c.codfil, c.nosnum);
        const snap = normalizeAgenteProdutorSnapshot(resp);
        actions.saveAgenteProdutor(c.id, snap);
        if (snap.agentes.length || snap.produtores.length) ok++; else semDados++;
      } catch {
        falha++;
      }
    }
    setRodando(false); setProgresso(null);
    alert(`Importação concluída: ${ok} com agente/produtor encontrado, ${semDados} sem dados, ${falha} com erro.`);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Importar Agente/Produtor em lote</h3>
      <p className="muted">
        Busca o Agente e o(s) Produtor(es) de cada processo sincronizado da API CORP (endpoint /documento, vinculado pelo Nosso Número) e guarda pra uso no filtro de Agente/Produtor em Sinistros e no vínculo de acesso de usuários "Consulta". Processos criados manualmente são ignorados (não têm Nosso Número real da API).
      </p>
      <button className="btn" disabled={rodando} onClick={importar}>
        {rodando && progresso ? `Buscando... ${progresso.atual}/${progresso.total}` : "Importar Agente/Produtor de todos os processos"}
      </button>
    </div>
  );
}
