import { useState } from "react";
import { distinctAgentes, distinctProdutores, distinctGruposProdutores, getAgentesEfetivo } from "../../logic/claims";

// Catálogo de agentes e produtores — a pedido do usuário, "bem parecido com
// Oficina/Seguradora/Clientes": agentes/produtores já vistos em processos
// sincronizados (via ImportarAgenteProdutorCard ou ao abrir Visão geral/
// Anexos de um processo) aparecem aqui automaticamente; o admin também pode
// incluir um agente manualmente (produtor não tem cadastro manual — só vem
// de processo já buscado). Listas em caixa com rolagem + busca (a pedido
// do usuário: com muitos itens, o antigo layout em "chips" soltos ficava
// impossível de enxergar tudo), com contador pra conferir se bateu com o
// esperado. Usado no vínculo de acesso de usuários "Consulta" e no filtro
// de Sinistros.
export function AgentesCatalogoCard({ config, saveConfig, overrides, claims, canEdit }) {
  const [buscaAg, setBuscaAg] = useState("");
  const [buscaPr, setBuscaPr] = useState("");
  const [buscaGr, setBuscaGr] = useState("");

  const descobertos = distinctAgentes(overrides, claims);
  const todosAgentes = getAgentesEfetivo(config, overrides, claims);
  const todosProdutores = distinctProdutores(overrides, claims);
  const todosGrupos = distinctGruposProdutores(overrides, claims);
  const agFiltrados = todosAgentes.filter((a) => a.toLowerCase().indexOf(buscaAg.toLowerCase()) >= 0);
  const prFiltrados = todosProdutores.filter((p) => p.toLowerCase().indexOf(buscaPr.toLowerCase()) >= 0);
  const grFiltrados = todosGrupos.filter((g) => g.toLowerCase().indexOf(buscaGr.toLowerCase()) >= 0);

  function adicionar(v) {
    if (!canEdit) return;
    const nome = (v || "").trim();
    if (!nome) return;
    if (todosAgentes.indexOf(nome) >= 0) { alert("Esse agente já está na lista."); return; }
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
      <h3 style={{ marginTop: 0 }}>Agentes e Produtores</h3>
      <p className="muted">
        Listas usadas pra filtrar Sinistros e vincular usuários "Consulta". Agentes/produtores já encontrados em processos sincronizados aparecem aqui automaticamente — se faltar algum, rode "Importar Agente/Produtor em lote" abaixo. Agentes também podem ser incluídos manualmente. "Grupo de Produtores" junta produtores que só se diferenciam pelo sufixo de unidade no nome (ex.: "NOME - BATALHA" e "NOME - GRAND ROSA" viram um grupo só).
      </p>
      <div className="grid c3">
        <div>
          <label style={{ fontWeight: 700 }}>Agentes ({todosAgentes.length})</label>
          <input placeholder="Buscar agente..." value={buscaAg} onChange={(e) => setBuscaAg(e.target.value)} style={{ marginTop: 4, marginBottom: 6 }} />
          <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
            {!todosAgentes.length ? (
              <div className="muted" style={{ fontSize: 12 }}>Nenhum agente ainda — importe Agente/Produtor em lote (abaixo) ou adicione manualmente.</div>
            ) : !agFiltrados.length ? (
              <div className="muted" style={{ fontSize: 12 }}>Nenhum agente encontrado para "{buscaAg}".</div>
            ) : agFiltrados.map((a) => (
              <div key={a} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 13 }}>
                <span>{a}</span>
                {descobertos.indexOf(a) < 0 && canEdit && <a style={{ color: "var(--danger)", cursor: "pointer", fontSize: 12, flexShrink: 0 }} onClick={() => remover(a)}>✕ remover</a>}
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="chips" style={{ marginTop: 8, alignItems: "center" }}>
              <input className="inline" placeholder="Novo agente..." style={{ minWidth: 160 }} ref={(el) => { addInput = el; }} />
              <button className="btn sec sm" onClick={() => { adicionar(addInput.value || ""); if (addInput) addInput.value = ""; }}>+ Agente</button>
            </div>
          )}
        </div>

        <div>
          <label style={{ fontWeight: 700 }}>Produtores ({todosProdutores.length})</label>
          <input placeholder="Buscar produtor..." value={buscaPr} onChange={(e) => setBuscaPr(e.target.value)} style={{ marginTop: 4, marginBottom: 6 }} />
          <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
            {!todosProdutores.length ? (
              <div className="muted" style={{ fontSize: 12 }}>Nenhum produtor ainda — importe Agente/Produtor em lote (abaixo).</div>
            ) : !prFiltrados.length ? (
              <div className="muted" style={{ fontSize: 12 }}>Nenhum produtor encontrado para "{buscaPr}".</div>
            ) : prFiltrados.map((p) => (
              <div key={p} style={{ padding: "4px 2px", fontSize: 13 }}>{p}</div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Produtor não tem cadastro manual — só vem de processos já buscados.</p>
        </div>

        <div>
          <label style={{ fontWeight: 700 }}>Grupo de Produtores ({todosGrupos.length})</label>
          <input placeholder="Buscar grupo..." value={buscaGr} onChange={(e) => setBuscaGr(e.target.value)} style={{ marginTop: 4, marginBottom: 6 }} />
          <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
            {!todosGrupos.length ? (
              <div className="muted" style={{ fontSize: 12 }}>Nenhum grupo ainda — importe Agente/Produtor em lote (abaixo).</div>
            ) : !grFiltrados.length ? (
              <div className="muted" style={{ fontSize: 12 }}>Nenhum grupo encontrado para "{buscaGr}".</div>
            ) : grFiltrados.map((g) => (
              <div key={g} style={{ padding: "4px 2px", fontSize: 13 }}>{g}</div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Derivado automaticamente dos produtores — sem cadastro manual.</p>
        </div>
      </div>
    </div>
  );
}
