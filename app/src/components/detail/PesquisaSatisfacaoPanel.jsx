import { useState } from "react";
import { StarRating } from "../StarRating.jsx";
import { getPesquisaSatisfacao, isFinalizado } from "../../logic/claims";

const ALVOS = [
  ["corretora", "Corretora", "Como o cliente avalia o atendimento da corretora neste processo?"],
  ["seguradora", "Seguradora", "Como o cliente avalia o atendimento da seguradora neste processo?"],
  ["oficina", "Oficina", "Como o cliente avalia o serviço da oficina neste processo?"],
];

function alvoVazio() { return { nota: 0, comentario: "", naoAplica: false }; }

// Pesquisa de satisfação (Fase 4) — registro manual da satisfação do
// cliente com a corretora, a seguradora e a oficina deste processo. A
// pedido do usuário, NÃO bloqueia nada tecnicamente: "Indenizado"/"Sem
// Indenização" vêm sincronizados da API do CORP, não são uma ação dentro
// do sistema. O que existe é: fica disponibilizada como pendência (ver
// PainelItem em DetailHeader.jsx) assim que o processo já chegou nesse
// status, com "Não se aplica" como opção válida pra qualquer um dos 3
// alvos. Os registros alimentam a nota média mostrada em
// Oficinas/Seguradoras/Clientes (Métricas).
export function PesquisaSatisfacaoPanel({ c, overrides, actions, canEdit }) {
  const atual = getPesquisaSatisfacao(overrides, c.id);
  const [dados, setDados] = useState(() => ({
    corretora: (atual && atual.corretora) || alvoVazio(),
    seguradora: (atual && atual.seguradora) || alvoVazio(),
    oficina: (atual && atual.oficina) || alvoVazio(),
  }));
  const finalizado = isFinalizado(overrides, c);

  function setAlvo(key, patch) {
    setDados((cur) => ({ ...cur, [key]: { ...cur[key], ...patch } }));
  }

  function salvar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const semDecisao = ALVOS.filter(([key]) => !dados[key].naoAplica && !dados[key].nota);
    if (semDecisao.length) {
      if (!confirm(`Falta dar nota ou marcar "Não se aplica" pra: ${semDecisao.map(([, label]) => label).join(", ")}. Salvar mesmo assim?`)) return;
    }
    actions.savePesquisaSatisfacao(c.id, dados);
    actions.logAudit(c.id, "Pesquisa de satisfação registrada", "");
    alert("Pesquisa de satisfação salva.");
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Pesquisa de satisfação</h3>
        {atual && <span className="badge green">Registrada em {new Date(atual.respondidoEm).toLocaleDateString("pt-BR")}</span>}
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        {finalizado
          ? "Este processo já chegou como Indenizado/Sem Indenização — é o momento de registrar a satisfação do cliente. Pode marcar \"Não se aplica\" pra qualquer um dos 3 alvos."
          : "Fica disponível a qualquer momento, mas o uso esperado é depois que o processo chegar como Indenizado ou Sem Indenização (vindo da seguradora)."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
        {ALVOS.map(([key, label, pergunta]) => {
          const alvo = dados[key];
          return (
            <div key={key} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <b style={{ fontSize: 13 }}>{label}</b>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={alvo.naoAplica} onChange={(e) => setAlvo(key, { naoAplica: e.target.checked, nota: 0 })} />
                  Não se aplica
                </label>
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{pergunta}</div>
              {!alvo.naoAplica && (
                <>
                  <StarRating value={alvo.nota} onChange={(v) => setAlvo(key, { nota: v })} />
                  <textarea
                    rows={2} style={{ marginTop: 8 }} placeholder="Comentário (opcional)"
                    value={alvo.comentario} onChange={(e) => setAlvo(key, { comentario: e.target.value })}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn" style={{ marginTop: 14 }} onClick={salvar}>Salvar pesquisa de satisfação</button>
    </div>
  );
}
