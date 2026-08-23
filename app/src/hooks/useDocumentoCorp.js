import { useEffect, useState } from "react";
import { isManualClaim } from "../logic/claims";
import { fetchDocumento } from "../logic/corpApi";

// Busca sob demanda o endpoint /documento do CORP pra um processo, vinculado
// por codfil+nosnum (nosnum é a chave universal do CORP, mesmo valor já
// usado pra identificar o sinistro). Usado tanto pra Agente/Produtor (Visão
// geral) quanto pra url_apolice (Anexos) — cada tela que chama este hook
// dispara sua própria busca ao montar; sem cache entre abas (GET simples,
// custo baixo, evita a complexidade de estado compartilhado entre telas).
export function useDocumentoCorp(c, config) {
  const [resp, setResp] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (isManualClaim(c) || !c.nosnum) return;
    let cancelado = false;
    setCarregando(true); setErro(null);
    fetchDocumento((config && config.corp_cfg) || {}, c.codfil, c.nosnum)
      .then((r) => { if (!cancelado) setResp(r); })
      .catch((e) => { if (!cancelado) setErro(e.message || "Falha ao buscar dados do CORP."); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  return { resp, carregando, erro };
}
