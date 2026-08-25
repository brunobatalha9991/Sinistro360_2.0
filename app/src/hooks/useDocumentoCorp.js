import { useEffect, useState } from "react";
import { isManualClaim } from "../logic/claims";
import { fetchDocumento, normalizeAgenteProdutorSnapshot } from "../logic/corpApi";

// Busca sob demanda o endpoint /documento do CORP pra um processo, vinculado
// por codfil+nosnum (nosnum é a chave universal do CORP, mesmo valor já
// usado pra identificar o sinistro). Usado tanto pra Agente/Produtor (Visão
// geral) quanto pra url_apolice (Anexos) — cada tela que chama este hook
// dispara sua própria busca ao montar; sem cache entre abas (GET simples,
// custo baixo, evita a complexidade de estado compartilhado entre telas).
//
// Quando `actions` é passado, o resultado também é persistido em
// overrides[c.id].agenteProdutor (cache oportunista, sem esperar a
// importação em lote) — é o que alimenta o filtro de Agente/Produtor em
// Sinistros e o vínculo de acesso de usuários "Consulta". EXCETO se o
// usuário já editou manualmente os pares de Agente/Produtor deste processo
// (overrides[c.id].agenteProdutorManual — ver GeralPanel.jsx e
// useOverrideActions.saveAgenteProdutorPares): nesse caso a edição já é a
// fonte da verdade e uma nova busca ao CORP não pode sobrescrevê-la.
export function useDocumentoCorp(c, config, actions, overrides) {
  const [resp, setResp] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (isManualClaim(c) || !c.nosnum) return;
    let cancelado = false;
    setCarregando(true); setErro(null);
    fetchDocumento((config && config.corp_cfg) || {}, c.codfil, c.nosnum)
      .then((r) => {
        if (cancelado) return;
        setResp(r);
        const jaEditadoManualmente = !!(overrides && overrides[c.id] && overrides[c.id].agenteProdutorManual);
        if (!jaEditadoManualmente && actions && actions.saveAgenteProdutor) actions.saveAgenteProdutor(c.id, normalizeAgenteProdutorSnapshot(r));
      })
      .catch((e) => { if (!cancelado) setErro(e.message || "Falha ao buscar dados do CORP."); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  return { resp, carregando, erro };
}
