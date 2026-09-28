import { useState } from "react";
import { distinctGruposProdutores, grupoConsideradoDoClaim, getGruposOcultosDashboard } from "../../logic/claims";

// Quais Grupos de Produtores aparecem no Dashboard (a pedido do usuário) —
// lista completa dos grupos encontrados nos processos, cada um com um
// interruptor de habilitado/desabilitado. Só os habilitados entram nas
// listagens por grupo do Dashboard ("Grupos de Produtores por Volume",
// "Quantidade de Processos por Grupo de Produtores" e o filtro de Grupo da
// barra do Dashboard).
//
// Desabilitar um grupo NÃO some com os processos dele: eles continuam
// contando em todos os outros números do Dashboard (total do recorte,
// situações, financeiro, tempos). É só uma escolha de quem aparece na
// listagem por grupo.
//
// O que fica salvo (corp_dashboard_grupos_ocultos) são os grupos OCULTOS, e
// não os visíveis — assim um grupo novo, que apareça numa sincronização
// futura, já nasce visível sem ninguém precisar habilitar na mão.
export function GruposDashboardCard({ config, saveConfig, overrides, claims, canEdit }) {
  const [busca, setBusca] = useState("");

  const todos = distinctGruposProdutores(overrides, claims);
  const ocultos = getGruposOcultosDashboard(config);
  const habilitados = todos.filter((g) => ocultos.indexOf(g) < 0).length;

  // Quantos processos cada grupo tem hoje — ajuda a decidir o que esconder.
  // Mesma regra do Dashboard: um processo conta uma vez só, no grupo do
  // produtor considerado (ver grupoConsideradoDoClaim).
  const contagem = {};
  (claims || []).forEach((c) => {
    const g = grupoConsideradoDoClaim(config, overrides, c.id);
    if (g) contagem[g] = (contagem[g] || 0) + 1;
  });

  const filtrados = todos.filter((g) => g.toLowerCase().indexOf(busca.toLowerCase()) >= 0);

  function alternar(g) {
    if (!canEdit) return;
    saveConfig("corp_dashboard_grupos_ocultos", (cur) => {
      const atual = cur || [];
      return atual.indexOf(g) >= 0 ? atual.filter((x) => x !== g) : [...atual, g];
    });
  }
  function habilitarTodos() {
    if (!canEdit) return;
    saveConfig("corp_dashboard_grupos_ocultos", []);
  }
  function desabilitarTodos() {
    if (!canEdit) return;
    if (!confirm("Desabilitar todos os grupos? O Dashboard vai ficar sem nenhuma linha nas listagens por Grupo de Produtores.")) return;
    saveConfig("corp_dashboard_grupos_ocultos", todos.slice());
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Grupos de Produtores no Dashboard</h3>
      <p className="muted">
        Marque quais grupos devem aparecer nas listagens por Grupo de Produtores do Dashboard (ranking, tabela de quantidade e
        filtro). Desabilitar um grupo não tira os processos dele do Dashboard — eles continuam contando no total do recorte e em
        todos os outros indicadores; o grupo só deixa de aparecer nas listagens por grupo. Grupo novo que surgir numa
        sincronização futura já entra habilitado.
      </p>

      <div className="chips" style={{ alignItems: "center" }}>
        <span className="badge blue">{habilitados} de {todos.length} habilitado(s)</span>
        {canEdit && <button className="btn sec sm" onClick={habilitarTodos}>Habilitar todos</button>}
        {canEdit && <button className="btn sec sm" onClick={desabilitarTodos}>Desabilitar todos</button>}
      </div>

      <input placeholder="Buscar grupo..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginTop: 4, marginBottom: 6 }} />
      <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
        {!todos.length ? (
          <div className="muted" style={{ fontSize: 12 }}>Nenhum grupo ainda — rode "Importar Agente/Produtor em lote" abaixo.</div>
        ) : !filtrados.length ? (
          <div className="muted" style={{ fontSize: 12 }}>Nenhum grupo encontrado para "{busca}".</div>
        ) : filtrados.map((g) => {
          const habilitado = ocultos.indexOf(g) < 0;
          return (
            <label
              key={g}
              style={{ display: "flex", gap: 9, alignItems: "center", padding: "5px 4px", cursor: canEdit ? "pointer" : "default", fontSize: 13, opacity: habilitado ? 1 : 0.55 }}
            >
              <input type="checkbox" checked={habilitado} disabled={!canEdit} onChange={() => alternar(g)} />
              <span style={{ flex: 1, textDecoration: habilitado ? "none" : "line-through" }}>{g}</span>
              <span className="muted mono" style={{ fontSize: 11.5, flexShrink: 0 }}>{contagem[g] || 0} processo(s)</span>
            </label>
          );
        })}
      </div>
      {!canEdit && <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Seu perfil é apenas de consulta — só administradores mudam esta lista.</p>}
    </div>
  );
}
