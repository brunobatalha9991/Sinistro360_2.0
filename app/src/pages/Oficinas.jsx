import { useMemo, useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useHashRoute } from "../hooks/useHashRoute";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "../components/EmptyState.jsx";
import { visibleClaims } from "../logic/claims";
import {
  listaOficinas, oficinaClaims, oficinaComsOficina, oficinaAvaliacaoMedia,
} from "../logic/oficinas";

// Módulo Oficinas (Fase 1) — lista com busca por nome; cada linha abre o
// cadastro/histórico completo (Oficina.jsx). Reaproveita a identidade já
// usada em todo o sistema (nome exato vindo da API, via campoEfetivo).
export function Oficinas() {
  const { records } = useData();
  const { navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const [busca, setBusca] = useState("");

  const claims = visibleClaims(records.corp_claims, records.corp_overrides, currentUser);
  const overrides = records.corp_overrides || {};
  const ocorrencias = records.corp_oficina_ocorrencias || [];

  const linhas = useMemo(() => {
    const lista = listaOficinas(claims, overrides);
    return lista.map((o) => {
      const cs = oficinaClaims(claims, overrides, o.nome);
      const coms = oficinaComsOficina(claims, overrides, o.nome);
      const media = oficinaAvaliacaoMedia(coms);
      const abertas = ocorrencias.filter((x) => x.oficinaId === o.id && x.status === "aberta").length;
      return { ...o, qtdSinistros: cs.length, media, reclamacoesAbertas: abertas };
    });
  }, [claims, overrides, ocorrencias]);

  const filtradas = busca.trim()
    ? linhas.filter((o) => o.nome.toLowerCase().indexOf(busca.trim().toLowerCase()) >= 0)
    : linhas;

  return (
    <div className="page-enter">
      <div className="page-head">
        <div>
          <h1>Oficinas</h1>
          <p>{linhas.length} oficina(s) — cadastro, reclamações, comunicação e métricas de qualidade</p>
        </div>
      </div>

      <div className="card">
        <input placeholder="Buscar oficina por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 360 }} />

        {filtradas.length ? (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Oficina</th>
                <th>Sinistros</th>
                <th>Nota média</th>
                <th>Reclamações abertas</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o) => (
                <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => navigate("oficina", o.id)}>
                  <td><a>{o.nome}</a></td>
                  <td>{o.qtdSinistros}</td>
                  <td>{o.media != null ? `${o.media.toFixed(1)} ★` : "—"}</td>
                  <td>{o.reclamacoesAbertas > 0 ? <span className="badge red">{o.reclamacoesAbertas}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ marginTop: 14 }}><EmptyState>Nenhuma oficina encontrada.</EmptyState></div>
        )}
      </div>
    </div>
  );
}
