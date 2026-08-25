import { useState } from "react";
import { consultarCorp, fetchDocumento, extractUrlApolice } from "../logic/corpApi";
import { todayISO } from "../logic/format";

function anosAtras(n) { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); }
function brDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Consulta AO VIVO no CORP por nome/placa — a pedido do usuário: em vez de
// importar a base inteira de clientes (pesado, maioria nunca usada), busca
// só quando precisa e não grava nada aqui (nem o resultado, nem a apólice).
// Reaproveitável: Clientes.jsx (achar algo sem precisar ter processo aqui
// ainda) e Abertura.jsx (preencher o formulário a partir de um resultado,
// via `onUsar`).
export function ConsultaCorpBox({ config, termoInicial, onUsar }) {
  const cfg = config.corp_cfg || {};
  const configurado = !!(cfg.url && cfg.email);
  const [termo, setTermo] = useState(termoInicial || "");
  const [dataInicial, setDataInicial] = useState(anosAtras(5));
  const [dataFinal, setDataFinal] = useState(todayISO());
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [apolices, setApolices] = useState({});

  function buscar() {
    const t = termo.trim();
    if (!t) { setErro("Digite um nome ou placa."); return; }
    setBuscando(true); setErro(null); setResultados(null);
    consultarCorp(cfg, { termo: t, dataInicial: brDate(dataInicial), dataFinal: brDate(dataFinal) })
      .then((rows) => setResultados(rows))
      .catch((e) => setErro(e.message))
      .finally(() => setBuscando(false));
  }

  function verApolice(r) {
    const chave = `${r.codfil}|${r.nosnum}`;
    setApolices((s) => ({ ...s, [chave]: { carregando: true } }));
    fetchDocumento(cfg, r.codfil, r.nosnum)
      .then((resp) => {
        const url = extractUrlApolice(resp);
        setApolices((s) => ({ ...s, [chave]: { carregando: false, url: url || null, erro: url ? null : "Nenhuma apólice encontrada para este registro." } }));
        if (url) window.open(url, "_blank", "noreferrer");
      })
      .catch((e) => setApolices((s) => ({ ...s, [chave]: { carregando: false, erro: e.message } })));
  }

  if (!configurado) {
    return <p className="muted" style={{ fontSize: 12 }}>Configure a conexão com o CORP em "Integração CORP" para habilitar a consulta ao vivo.</p>;
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Busca ao vivo direto na API do CORP, por nome ou placa — não grava nada aqui, é só consulta.
      </p>
      <div className="chips" style={{ alignItems: "center" }}>
        <input
          className="inline" style={{ minWidth: 220 }} placeholder="Nome do segurado ou placa..." value={termo}
          onChange={(e) => setTermo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
        />
        <span className="muted" style={{ fontSize: 12 }}>de</span>
        <input type="date" className="inline" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>até</span>
        <input type="date" className="inline" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
        <button className="btn sec sm" disabled={buscando} onClick={buscar}>{buscando ? "Buscando..." : "🔍 Buscar no CORP"}</button>
      </div>
      {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erro}</div>}
      {resultados && (
        resultados.length ? (
          <div style={{ overflow: "auto", marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>Placa</th><th>Nº sinistro</th><th>Situação</th><th>Seguradora</th><th>Ramo</th><th>Dt. Ocorrência</th>
                  <th>Apólice</th>{onUsar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => {
                  const chave = `${r.codfil}|${r.nosnum}`;
                  const ap = apolices[chave];
                  return (
                    <tr key={chave + i}>
                      <td>{r.segurado || "—"}</td>
                      <td className="mono">{r.placa || "—"}</td>
                      <td className="mono">{r.numsin || "—"}</td>
                      <td>{r.situacao || "—"}</td>
                      <td>{r.cia || "—"}</td>
                      <td>{r.ramo || "—"}</td>
                      <td>{r.datoco || "—"}</td>
                      <td>
                        {ap && ap.carregando ? "Buscando..." : ap && ap.url ? <a href={ap.url} target="_blank" rel="noreferrer">Abrir</a> : (
                          <button className="btn ghost xs" onClick={() => verApolice(r)}>Ver</button>
                        )}
                        {ap && ap.erro && <div className="muted" style={{ fontSize: 10.5 }}>{ap.erro}</div>}
                      </td>
                      {onUsar && <td><button className="btn sec xs" onClick={() => onUsar(r)}>Usar</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Nenhum resultado no CORP para esse período/termo.</p>
      )}
    </div>
  );
}
