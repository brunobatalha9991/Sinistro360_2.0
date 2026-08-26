import { useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/EmptyState.jsx";
import { visibleClaims } from "../logic/claims";
import {
  listaSeguradoras, seguradoraClaims, seguradoraComsSeguradora, seguradoraAvaliacaoMedia,
} from "../logic/seguradoras";

// Módulo Seguradoras (Fase 2) — mesmo padrão de Oficinas.jsx.
export function Seguradoras() {
  const { records } = useData();
  const { navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const [busca, setBusca] = useState("");

  const claims = visibleClaims(records.corp_claims, records.corp_overrides, currentUser);
  const overrides = records.corp_overrides || {};
  const ocorrencias = records.corp_seguradora_ocorrencias || [];

  const linhas = useMemo(() => {
    const lista = listaSeguradoras(claims, overrides);
    return lista.map((s) => {
      const cs = seguradoraClaims(claims, overrides, s.nome);
      const coms = seguradoraComsSeguradora(claims, overrides, s.nome);
      const media = seguradoraAvaliacaoMedia(coms);
      const abertas = ocorrencias.filter((x) => x.seguradoraId === s.id && x.status === "aberta").length;
      return { ...s, qtdSinistros: cs.length, media, reclamacoesAbertas: abertas };
    });
  }, [claims, overrides, ocorrencias]);

  const filtradas = busca.trim()
    ? linhas.filter((s) => s.nome.toLowerCase().indexOf(busca.trim().toLowerCase()) >= 0)
    : linhas;

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Seguradoras</h1>
          <p>{linhas.length} seguradora(s) — cadastro, reclamações, comunicação e métricas de qualidade</p>
        </div>
      </div>

      <div className="card">
        <input placeholder="Buscar seguradora por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 360 }} />

        {filtradas.length ? (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Seguradora</th>
                <th>Sinistros</th>
                <th>Nota média</th>
                <th>Reclamações abertas</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => (
                <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => navigate("seguradora", s.id)}>
                  <td><a>{s.nome}</a></td>
                  <td>{s.qtdSinistros}</td>
                  <td>{s.media != null ? `${s.media.toFixed(1)} ★` : "—"}</td>
                  <td>{s.reclamacoesAbertas > 0 ? <span className="badge red">{s.reclamacoesAbertas}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ marginTop: 14 }}><EmptyState>Nenhuma seguradora encontrada.</EmptyState></div>
        )}
      </div>
    </div>
  );
}
