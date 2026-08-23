import { distinctAgentes, getAgentesEfetivo } from "../../logic/claims";

// Catálogo de agentes — a pedido do usuário, "bem parecido com Oficina/
// Seguradora/Clientes": agentes já vistos em processos sincronizados
// (via ImportarAgenteProdutorCard ou ao abrir Visão geral/Anexos de um
// processo) aparecem aqui automaticamente; o admin também pode incluir um
// agente manualmente (útil se um agente novo ainda não apareceu em nenhum
// processo buscado). Usado no vínculo de acesso de usuários "Consulta" e
// no filtro de Sinistros.
export function AgentesCatalogoCard({ config, saveConfig, overrides, claims, canEdit }) {
  const descobertos = distinctAgentes(overrides, claims);
  const todos = getAgentesEfetivo(config, overrides, claims);

  function adicionar(v) {
    if (!canEdit) return;
    const nome = (v || "").trim();
    if (!nome) return;
    if (todos.indexOf(nome) >= 0) { alert('Esse agente já está na lista.'); return; }
    saveConfig("corp_agentes_catalogo", (cur) => [...(cur || []), nome]);
  }
  function remover(nome) {
    if (!canEdit) return;
    if (descobertos.indexOf(nome) >= 0) {
      alert('Este agente veio automaticamente de processos sincronizados — não pode ser removido daqui (só some se os processos deixarem de trazê-lo, ao reimportar).');
      return;
    }
    if (confirm(`Remover "${nome}" da lista?`)) saveConfig("corp_agentes_catalogo", (cur) => (cur || []).filter((x) => x !== nome));
  }

  let addInput;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Agentes</h3>
      <p className="muted">
        Lista de agentes usada pra filtrar Sinistros e vincular usuários "Consulta". Agentes já encontrados em processos sincronizados aparecem aqui automaticamente; você também pode incluir um agente manualmente.
      </p>
      <div className="chips" style={{ alignItems: "center" }}>
        {todos.length ? todos.map((a) => (
          <span key={a} className="badge gray" style={{ gap: 6 }}>
            <span>{a}</span>
            {descobertos.indexOf(a) < 0 && canEdit && <a style={{ color: "var(--danger)" }} onClick={() => remover(a)}>✕</a>}
          </span>
        )) : <span className="muted" style={{ fontSize: 12 }}>Nenhum agente ainda — importe Agente/Produtor em lote (abaixo) ou adicione manualmente.</span>}
      </div>
      {canEdit && (
        <div className="chips" style={{ marginTop: 10, alignItems: "center" }}>
          <input className="inline" placeholder="Novo agente..." style={{ minWidth: 200 }} ref={(el) => { addInput = el; }} />
          <button className="btn sec sm" onClick={() => { adicionar(addInput.value || ""); if (addInput) addInput.value = ""; }}>+ Agente</button>
        </div>
      )}
    </div>
  );
}
