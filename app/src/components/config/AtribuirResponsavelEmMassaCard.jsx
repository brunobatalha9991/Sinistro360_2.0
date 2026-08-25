import { useMemo, useState } from "react";
import { situacaoEfetiva, getResponsavel } from "../../logic/claims";
import { txt } from "../../logic/format";

// Um bloco independente por situação (Pendente / Em andamento) — cada um
// com seu próprio responsável escolhido, a pedido do usuário: os dois
// grupos podem ganhar responsáveis diferentes.
function BlocoStatus({ status, claims, overrides, users, actions, canEdit, atendTemplateCfg }) {
  const [usuarioId, setUsuarioId] = useState("");
  const [resultado, setResultado] = useState(null);

  const semResponsavel = useMemo(() => claims.filter((c) => (
    situacaoEfetiva(overrides, c, atendTemplateCfg).label === status && !getResponsavel(overrides, c.id)
  )), [claims, overrides, status, atendTemplateCfg]);

  function aplicar() {
    if (!canEdit) { alert("Apenas administradores podem executar esta atribuição em massa."); return; }
    if (!usuarioId) { alert("Selecione um usuário."); return; }
    const usuario = users.find((u) => u.id === usuarioId);
    if (!usuario) return;
    if (!semResponsavel.length) { alert(`Não há processos "${status}" sem responsável no momento.`); return; }
    if (!confirm(`Definir "${usuario.nome}" como responsável de ${semResponsavel.length} processo(s) "${status}" sem responsável atual?`)) return;

    semResponsavel.forEach((c) => {
      actions.saveResponsavel(c.id, usuario, {
        motivo: `Atribuição em massa via Configurações (processo "${status}" estava sem responsável)`,
        origem: "regra_automatica",
      });
    });
    setResultado({ quantidade: semResponsavel.length, usuario: usuario.nome });
    setUsuarioId("");
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13 }}>{status}</b>
        <span className="badge amber">{semResponsavel.length}</span>
        <span className="muted" style={{ fontSize: 12 }}>sem responsável</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <select className="inline" style={{ minWidth: 220 }} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
          <option value="">Selecione o responsável...</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>)}
        </select>
        <button className="btn" onClick={aplicar} disabled={!semResponsavel.length || !usuarioId}>Aplicar em "{status}"</button>
      </div>
      {resultado && (
        <p style={{ marginTop: 8, fontSize: 13 }}>
          ✔ {resultado.quantidade} processo(s) "{status}" atualizado(s) — responsável definido como <b>{txt(resultado.usuario)}</b>.
        </p>
      )}
    </div>
  );
}

// Atribuição em massa de responsável (a pedido do usuário): dois blocos
// independentes, um para "Pendente" e outro para "Em andamento" — cada um
// pode ganhar um responsável diferente. Aplica só a processos AINDA SEM
// responsável — nunca sobrescreve quem já está definido. Reaproveita
// useOverrideActions().saveResponsavel(), que já grava overrides.responsavelUser
// E o intervalo em corp_responsabilidade_historico (Fase 2) pra cada processo.
export function AtribuirResponsavelEmMassaCard({ claims, overrides, users, actions, canEdit, atendTemplateCfg }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Atribuir responsável em massa</h3>
      <p className="muted">
        Define um responsável para todos os processos de uma situação que ainda <b>não têm nenhum responsável definido</b> — "Pendente" e "Em andamento" são independentes e podem ganhar responsáveis diferentes. Processos que já têm responsável não são alterados.
      </p>
      <BlocoStatus status="Pendente" claims={claims} overrides={overrides} users={users} actions={actions} canEdit={canEdit} atendTemplateCfg={atendTemplateCfg} />
      <BlocoStatus status="Em andamento" claims={claims} overrides={overrides} users={users} actions={actions} canEdit={canEdit} atendTemplateCfg={atendTemplateCfg} />
    </div>
  );
}
