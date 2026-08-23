import { useData } from "../data/DataProvider.jsx";

// Estado local por e-mail (arquivado ou não) — a pedido do usuário: um
// "Arquivar" só some da caixa de entrada dentro do Sinistro360 (não mexe no
// Gmail de verdade, evita pedir um escopo de escrita novo pro Google).
// "Ver arquivados" (Emails.jsx) mostra de volta, igual ao padrão já usado
// em Tarefas.
export function useEmailStateActions() {
  const { records, saveRecord } = useData();
  const estado = records.corp_email_estado || {};

  function isArquivado(emailId) {
    return !!(estado[emailId] && estado[emailId].arquivado);
  }
  function arquivar(emailId) {
    saveRecord("corp_email_estado", (current) => {
      const cur = current || {};
      return { ...cur, [emailId]: { ...(cur[emailId] || {}), arquivado: true, arquivadoEm: new Date().toISOString() } };
    });
  }
  function desarquivar(emailId) {
    saveRecord("corp_email_estado", (current) => {
      const cur = current || {};
      return { ...cur, [emailId]: { ...(cur[emailId] || {}), arquivado: false } };
    });
  }

  return { estado, isArquivado, arquivar, desarquivar };
}
