import { useMemo, useState } from "react";
import { situacaoEfetiva, getResponsavel } from "../../logic/claims";
import { txt } from "../../logic/format";

// Atribuição em massa de responsável (a pedido do usuário): aplica só a
// processos Pendente/Em andamento que AINDA NÃO têm responsável — nunca
// sobrescreve quem já está definido. Reaproveita
// useOverrideActions().saveResponsavel(), que já grava overrides.responsavelUser
// E o intervalo em corp_responsabilidade_historico (Fase 2) pra cada processo.
export function AtribuirResponsavelEmMassaCard({ claims, overrides, users, actions, canEdit }) {
  const [usuarioId, setUsuarioId] = useState("");
  const [resultado, setResultado] = useState(null);

  const pendentes = useMemo(() => claims.filter((c) => {
    const sit = situacaoEfetiva(overrides, c).label;
    if (sit !== "Pendente" && sit !== "Em andamento") return false;
    return !getResponsavel(overrides, c.id);
  }), [claims, overrides]);

  function aplicar() {
    if (!canEdit) { alert("Apenas administradores podem executar esta atribuição em massa."); return; }
    if (!usuarioId) { alert("Selecione um usuário."); return; }
    const usuario = users.find((u) => u.id === usuarioId);
    if (!usuario) return;
    if (!pendentes.length) { alert("Não há processos pendentes de responsável no momento."); return; }
    if (!confirm(`Definir "${usuario.nome}" como responsável de ${pendentes.length} processo(s) Pendente/Em andamento sem responsável atual?`)) return;

    pendentes.forEach((c) => {
      actions.saveResponsavel(c.id, usuario, {
        motivo: "Atribuição em massa via Configurações (processo estava sem responsável)",
        origem: "regra_automatica",
      });
    });
    setResultado({ quantidade: pendentes.length, usuario: usuario.nome });
    setUsuarioId("");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Atribuir responsável em massa</h3>
      <p className="muted">
        Define um responsável para todos os processos <b>Pendente</b> ou <b>Em andamento</b> que ainda <b>não têm nenhum responsável definido</b>. Processos que já têm responsável não são alterados.
      </p>
      <p style={{ fontSize: 13 }}>
        <span className="badge amber">{pendentes.length}</span> processo(s) sem responsável neste momento.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select className="inline" style={{ minWidth: 220 }} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
          <option value="">Selecione o responsável...</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>)}
        </select>
        <button className="btn" onClick={aplicar} disabled={!pendentes.length || !usuarioId}>Aplicar</button>
      </div>
      {resultado && (
        <p style={{ marginTop: 10, fontSize: 13 }}>
          ✔ {resultado.quantidade} processo(s) atualizado(s) — responsável definido como <b>{txt(resultado.usuario)}</b>.
        </p>
      )}
    </div>
  );
}
