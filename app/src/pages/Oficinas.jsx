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
const COLUNAS_ORDENAVEIS = [
  ["nome", "Oficina"], ["qtdSinistros", "Sinistros"], ["media", "Nota média"], ["reclamacoesAbertas", "Reclamações abertas"],
];
// Ordenação padrão desligada por texto (nome) e ligada por número
// (sinistros/nota/reclamações) — a pedido do usuário, clicar numa coluna
// numérica já traz "mais alto primeiro" de cara, sem precisar clicar 2x.
const DIRECAO_PADRAO = { nome: "asc", qtdSinistros: "desc", media: "desc", reclamacoesAbertas: "desc" };

export function Oficinas() {
  const { records } = useData();
  const { navigate } = useHashRoute();
  const { currentUser } = useAuth();
  const [busca, setBusca] = useState("");
  // Reordenar clicando no título da coluna (a pedido do usuário) — começa
  // por Sinistros (desc), a mais útil pra achar rápido a oficina com mais
  // volume.
  const [sort, setSort] = useState({ key: "qtdSinistros", dir: "desc" });

  function ordenarPor(key) {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: DIRECAO_PADRAO[key] }));
  }

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

  const filtradas = useMemo(() => {
    const base = busca.trim()
      ? linhas.filter((o) => o.nome.toLowerCase().indexOf(busca.trim().toLowerCase()) >= 0)
      : linhas;
    const { key, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const va = a[key], vb = b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // "—" sempre por último, nas duas direções
      if (vb == null) return -1;
      if (typeof va === "string") return va.localeCompare(vb, "pt-BR") * mult;
      return (va - vb) * mult;
    });
  }, [linhas, busca, sort]);

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
                {COLUNAS_ORDENAVEIS.map(([key, label]) => (
                  <th key={key} style={{ cursor: "pointer", userSelect: "none" }} onClick={() => ordenarPor(key)} title="Clique para ordenar">
                    {label}{sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
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
