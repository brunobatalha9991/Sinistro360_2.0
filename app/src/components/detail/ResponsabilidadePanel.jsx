import { EmptyState } from "../EmptyState.jsx";
import { getHistoricoDoProcesso } from "../../logic/responsabilidade";
import { txt } from "../../logic/format";

const ORIGEM_LABEL = {
  manual: "Manual",
  importacao: "Importação",
  integracao: "Integração",
  regra_automatica: "Regra automática",
  estimado_legado: "Estimado (legado)",
};

function fmtDataHora(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function fmtDuracao(inicioISO, fimISO) {
  const ini = new Date(inicioISO).getTime();
  const fim = fimISO ? new Date(fimISO).getTime() : Date.now();
  if (isNaN(ini) || isNaN(fim) || fim < ini) return "—";
  const horas = (fim - ini) / 3600000;
  if (horas < 24) return horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "h";
  return (horas / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " dia(s)";
}

// Porte novo (Fase 2 — IA Sinistros): mostra os intervalos de vigência de
// responsável do processo, sempre com origem/motivo visíveis — nunca
// apresenta uma entrada "estimado_legado" como fato consolidado.
// Renderizado embutido dentro do card "Auditoria Interna" (AuditPanel.jsx)
// — sem card/wrapper próprio, por isso não tem <div className="card">.
export function ResponsabilidadePanel({ c, records }) {
  const historico = getHistoricoDoProcesso(records.corp_responsabilidade_historico, c.id).slice().reverse();
  const users = records.corp_users || [];
  const userNome = (id) => (users.find((u) => u.id === id) || {}).nome || "—";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h4 style={{ margin: 0 }}>Histórico de Responsabilidade</h4>
        <span className="muted" style={{ fontSize: 12 }}>{historico.length} intervalo(s) registrado(s)</span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Cada linha é um intervalo de vigência: quando o responsável do processo muda, o intervalo anterior é encerrado e um novo começa. Nunca é apagado.
      </p>
      {!historico.length ? (
        <EmptyState>
          Nenhum histórico estruturado ainda para este processo. Se ele já teve trocas de responsável antes desta funcionalidade existir, um administrador pode gerar uma estimativa em Configurações → Histórico de Responsabilidade.
        </EmptyState>
      ) : (
        <div style={{ overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Responsável</th><th>Início</th><th>Fim</th><th>Duração</th>
                <th>Origem</th><th>Motivo</th><th>Alterado por</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.id}>
                  <td>{userNome(h.usuarioResponsavelId)}</td>
                  <td className="mono">{fmtDataHora(h.inicioResponsabilidadeEm)}</td>
                  <td className="mono">{h.fimResponsabilidadeEm ? fmtDataHora(h.fimResponsabilidadeEm) : <span className="badge blue">vigente</span>}</td>
                  <td className="mono">{fmtDuracao(h.inicioResponsabilidadeEm, h.fimResponsabilidadeEm)}</td>
                  <td>
                    <span className={"badge " + (h.origemAlteracao === "estimado_legado" ? "gray" : "green")} title={h.origemAlteracao === "estimado_legado" ? "Reconstruído a partir de dados antigos — pode não ser exato" : ""}>
                      {ORIGEM_LABEL[h.origemAlteracao] || h.origemAlteracao}
                    </span>
                  </td>
                  <td style={{ maxWidth: 260 }}>{txt(h.motivoAlteracao)}</td>
                  <td>{h.alteradoPorUsuarioId ? userNome(h.alteradoPorUsuarioId) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
