import { Fragment, useState } from "react";
import { consultarCorp, fetchDocumento, extractDocumentoDetalhado } from "../logic/corpApi";
import { clienteIdFromNome } from "../logic/clientes";
import { todayISO, uid } from "../logic/format";

function anosAtras(n) { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); }
function brDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtBRL(v) { return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

// Painel com o máximo de informação que o /documento do CORP devolve (a
// pedido do usuário) — seguradora, vigência, valor, situação, parcelas e
// agente/produtor, além do link da apólice. Só exibição, nada é gravado.
function DetalhesDocumento({ dados }) {
  return (
    <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)" }}>
      <div className="grid c3" style={{ gap: 8, fontSize: 12.5 }}>
        <div><b>Seguradora:</b> {dados.seguradora || "—"}</div>
        <div><b>Ramo:</b> {dados.ramo || "—"}</div>
        <div><b>Apólice:</b> {dados.numeroApolice || "—"}{dados.numeroEndosso && dados.numeroEndosso !== "0" ? ` (end. ${dados.numeroEndosso})` : ""}</div>
        <div><b>Proposta:</b> {dados.numeroProposta || "—"}</div>
        <div><b>Vigência:</b> {dados.vigenciaInicio || "—"} a {dados.vigenciaFim || "—"}</div>
        <div><b>Valor total:</b> {fmtBRL(dados.valorTotal)} {dados.numeroParcelas ? `(${dados.numeroParcelas}x)` : ""}</div>
        <div><b>Forma de pagamento:</b> {dados.formaPagamento || "—"}</div>
        <div><b>Cliente (CORP):</b> {dados.cliente || "—"}</div>
        <div><b>Situação (sinistro):</b> {dados.situacaoSinistro || "—"}</div>
        <div style={{ gridColumn: "1 / -1" }}><b>Acompanhamento:</b> {dados.situacaoAcompanhamento || "—"}</div>
        {dados.situacaoRenovacao && <div style={{ gridColumn: "1 / -1", whiteSpace: "pre-wrap" }}><b>Renovação:</b> {dados.situacaoRenovacao}</div>}
      </div>

      {dados.prodDocs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <b style={{ fontSize: 12.5 }}>Agente / Produtor</b>
          {dados.prodDocs.map((p, i) => (
            <div key={i} className="muted" style={{ fontSize: 12 }}>{p.produtor} — agente: {p.agente}</div>
          ))}
        </div>
      )}

      {dados.parcelas.length > 0 && (
        <div style={{ marginTop: 10, overflow: "auto" }}>
          <b style={{ fontSize: 12.5 }}>Parcelas</b>
          <table style={{ marginTop: 4 }}>
            <thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Quitada em</th></tr></thead>
            <tbody>
              {dados.parcelas.map((p) => (
                <tr key={p.numero}>
                  <td className="mono">{p.numero}</td>
                  <td className="mono">{p.vencimento || "—"}</td>
                  <td className="mono">{fmtBRL(p.valor)}</td>
                  <td className="mono">{p.quitadoEm || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        {dados.urlApolice ? <a href={dados.urlApolice} target="_blank" rel="noreferrer" className="btn sec xs">📄 Abrir apólice (PDF)</a> : <span className="muted" style={{ fontSize: 12 }}>Nenhum PDF de apólice disponível para este registro.</span>}
        {dados.urlProposta && <a href={dados.urlProposta} target="_blank" rel="noreferrer" className="btn ghost xs" style={{ marginLeft: 8 }}>📄 Abrir proposta</a>}
      </div>
    </div>
  );
}

// Consulta AO VIVO no CORP por nome/placa — a pedido do usuário: em vez de
// importar a base inteira de clientes (pesado, maioria nunca usada), busca
// só quando precisa e não grava nada aqui (nem o resultado, nem a apólice).
// Reaproveitável: Clientes.jsx (achar algo sem precisar ter processo aqui
// ainda) e Abertura.jsx (preencher o formulário a partir de um resultado,
// via `onUsar`). `clienteActions` (useClienteActions()) habilita o botão
// "Importar" — a pedido do usuário, NÃO cria sinistro/terceiro/atendimento
// (isso já vem da sincronização normal), só grava o nome confirmado no
// cadastro do módulo Cliente (corp_clientes), pra ficar disponível ali
// mesmo sem nenhum processo local ainda.
export function ConsultaCorpBox({ config, termoInicial, onUsar, clienteActions, navigate }) {
  const cfg = config.corp_cfg || {};
  const configurado = !!(cfg.url && cfg.email);
  const [termo, setTermo] = useState(termoInicial || "");
  const [dataInicial, setDataInicial] = useState(anosAtras(5));
  const [dataFinal, setDataFinal] = useState(todayISO());
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [detalhes, setDetalhes] = useState({});
  const [importados, setImportados] = useState({});
  const podeImportar = !!clienteActions;

  function buscar() {
    const t = termo.trim();
    if (!t) { setErro("Digite um nome ou placa."); return; }
    setBuscando(true); setErro(null); setResultados(null);
    consultarCorp(cfg, { termo: t, dataInicial: brDate(dataInicial), dataFinal: brDate(dataFinal) })
      .then((rows) => setResultados(rows))
      .catch((e) => setErro(e.message))
      .finally(() => setBuscando(false));
  }

  // Traz o máximo de informação disponível sobre o registro (a pedido do
  // usuário) — não só a apólice: seguradora, vigência, valor, parcelas,
  // situação, agente/produtor. Alterna (mesmo botão fecha o painel aberto).
  function verDetalhes(r) {
    const chave = `${r.codfil}|${r.nosnum}|${r.tipo}`;
    if (detalhes[chave] && detalhes[chave].aberto) {
      setDetalhes((s) => ({ ...s, [chave]: { ...s[chave], aberto: false } }));
      return;
    }
    if (detalhes[chave] && detalhes[chave].dados) {
      setDetalhes((s) => ({ ...s, [chave]: { ...s[chave], aberto: true } }));
      return;
    }
    setDetalhes((s) => ({ ...s, [chave]: { carregando: true, aberto: true } }));
    fetchDocumento(cfg, r.codfil, r.nosnum)
      .then((resp) => {
        const dados = extractDocumentoDetalhado(resp);
        setDetalhes((s) => ({ ...s, [chave]: { carregando: false, aberto: true, dados, erro: dados ? null : "Nenhum documento encontrado para este registro." } }));
      })
      .catch((e) => setDetalhes((s) => ({ ...s, [chave]: { carregando: false, aberto: true, erro: e.message } })));
  }

  // Importa o NOME do cliente pro cadastro do módulo Cliente, e a URL da
  // apólice (quando já buscada em "Ver detalhes") como anexo dele — a
  // pedido do usuário: "quero consultar os dados de um cliente específico e
  // importar os dados para o módulo Cliente", inclusive pra quem ainda não
  // tem processo vinculado aqui. NÃO cria sinistro/terceiro/atendimento —
  // isso já vem da sincronização normal. Prefere o nome confirmado em "Ver
  // detalhes" (campo `cliente` do /documento, mais oficial); sem isso, cai
  // no nome do resultado da busca (`segurado`, de /sinistros).
  function importarCliente(r) {
    const chave = `${r.codfil}|${r.nosnum}|${r.tipo}`;
    const det = detalhes[chave];
    const dados = det && det.dados;
    const nome = ((dados && dados.cliente) || r.segurado || "").trim();
    if (!nome) return;
    const clienteId = clienteIdFromNome(nome);
    clienteActions.saveCadastro(clienteId, { nome });
    if (dados && dados.urlApolice) {
      const jaTem = ((clienteActions.clientes[clienteId] || {}).anexos || []).some((a) => a.url === dados.urlApolice);
      if (!jaTem) {
        const nomeAnexo = "Apólice" + (dados.numeroApolice ? ` ${dados.numeroApolice}` : "") + (dados.seguradora ? ` — ${dados.seguradora}` : "");
        clienteActions.addAnexo(clienteId, { id: uid("anx"), nome: nomeAnexo, url: dados.urlApolice, adicionadoEm: new Date().toISOString() });
      }
    }
    setImportados((s) => ({ ...s, [chave]: { status: "importado", clienteId } }));
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
                  <th>Detalhes</th>{podeImportar && <th>Importar p/ Cliente</th>}{onUsar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => {
                  const chave = `${r.codfil}|${r.nosnum}|${r.tipo}`;
                  const det = detalhes[chave];
                  const imp = importados[chave];
                  const totalCols = 8 + (podeImportar ? 1 : 0) + (onUsar ? 1 : 0);
                  return (
                    <Fragment key={chave + i}>
                      <tr>
                        <td className="nome-cliente">{r.segurado || "—"}</td>
                        <td className="mono">{r.placa || "—"}</td>
                        <td className="mono">{r.numsin || "—"}</td>
                        <td>{r.situacao || "—"}</td>
                        <td>{r.cia || "—"}</td>
                        <td>{r.ramo || "—"}</td>
                        <td>{r.datoco || "—"}</td>
                        <td>
                          <button className="btn ghost xs" disabled={det && det.carregando} onClick={() => verDetalhes(r)}>
                            {det && det.carregando ? "Buscando..." : det && det.aberto ? "▲ Ocultar" : "🔍 Ver detalhes"}
                          </button>
                          {det && det.erro && <div className="muted" style={{ fontSize: 10.5 }}>{det.erro}</div>}
                        </td>
                        {podeImportar && (
                          <td>
                            {!imp && <button className="btn ok xs" onClick={() => importarCliente(r)}>⬇ Importar p/ Cliente</button>}
                            {imp && imp.status === "importado" && <span className="badge green">✓ Importado</span>}
                            {imp && navigate && <a style={{ marginLeft: 6, fontSize: 12 }} onClick={() => navigate("cliente", imp.clienteId)}>Ver cliente</a>}
                          </td>
                        )}
                        {onUsar && <td><button className="btn sec xs" onClick={() => onUsar(r)}>Usar</button></td>}
                      </tr>
                      {det && det.aberto && det.dados && (
                        <tr>
                          <td colSpan={totalCols} style={{ padding: "6px 0 14px" }}><DetalhesDocumento dados={det.dados} /></td>
                        </tr>
                      )}
                    </Fragment>
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
