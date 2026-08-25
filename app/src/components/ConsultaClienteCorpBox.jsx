import { Fragment, useState } from "react";
import { buscarClientes, buscarClienteDetalhado } from "../logic/corpApi";
import { clienteIdFromNome } from "../logic/clientes";
import { uid } from "../logic/format";

// Busca CLIENTE ao vivo no CORP (GET /clientes?texto=) — a pedido do
// usuário: a consulta por sinistro (ConsultaCorpBox.jsx) só encontrava
// quem já tinha processo; essa busca direta encontra qualquer cliente
// cadastrado no CORP, com ou sem sinistro. Não grava nada sozinha — só o
// botão "Importar" grava, e só o registro escolhido.
export function ConsultaClienteCorpBox({ config, clienteActions, navigate }) {
  const cfg = config.corp_cfg || {};
  const configurado = !!(cfg.url && cfg.email);
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [detalhes, setDetalhes] = useState({});
  const [importados, setImportados] = useState({});

  function buscar() {
    const t = texto.trim();
    if (t.length < 4) { setErro("Digite pelo menos 4 caracteres."); return; }
    setBuscando(true); setErro(null); setResultados(null);
    buscarClientes(cfg, { texto: t, qtdPag: 30 })
      .then((rows) => setResultados(rows))
      .catch((e) => setErro(e.message))
      .finally(() => setBuscando(false));
  }

  function verDetalhes(c) {
    const chave = `${c.codfil}|${c.codigo}`;
    if (detalhes[chave] && detalhes[chave].aberto) {
      setDetalhes((s) => ({ ...s, [chave]: { ...s[chave], aberto: false } }));
      return;
    }
    if (detalhes[chave] && detalhes[chave].dados) {
      setDetalhes((s) => ({ ...s, [chave]: { ...s[chave], aberto: true } }));
      return;
    }
    setDetalhes((s) => ({ ...s, [chave]: { carregando: true, aberto: true } }));
    buscarClienteDetalhado(cfg, c.codfil, c.codigo)
      .then((dados) => setDetalhes((s) => ({ ...s, [chave]: { carregando: false, aberto: true, dados, erro: dados ? null : "Cliente não encontrado." } })))
      .catch((e) => setDetalhes((s) => ({ ...s, [chave]: { carregando: false, aberto: true, erro: e.message } })));
  }

  // Importa nome + CPF/CNPJ + contato (telefone/e-mail) pro cadastro do
  // módulo Cliente. Usa o detalhe completo (endereço) quando já buscado em
  // "Ver detalhes"; sem isso, cai no que a própria busca já trouxe.
  function importar(c) {
    const chave = `${c.codfil}|${c.codigo}`;
    const det = detalhes[chave];
    const dados = (det && det.dados) || c;
    const nome = String(dados.nome || c.nome || "").trim();
    if (!nome) return;
    const clienteId = clienteIdFromNome(nome);
    const endereco = Array.isArray(dados.enderecos) && dados.enderecos.length
      ? [dados.enderecos[0].logradouro, dados.enderecos[0].numero, dados.enderecos[0].bairro, dados.enderecos[0].cidade, dados.enderecos[0].estado].filter(Boolean).join(", ")
      : [dados.cidade, dados.estado].filter(Boolean).join(" - ");
    clienteActions.saveCadastro(clienteId, {
      nome,
      documento: dados.cpf_cnpj || "",
      endereco,
      contatos: [{ nome, telefone: dados.telefone || (Array.isArray(dados.telefones) && dados.telefones[0]) || "", email: dados.email || (Array.isArray(dados.emails) && dados.emails[0]) || "", cargo: "" }],
    });
    setImportados((s) => ({ ...s, [chave]: { status: "importado", clienteId } }));
  }

  if (!configurado) {
    return <p className="muted" style={{ fontSize: 12 }}>Configure a conexão com o CORP em "Integração CORP" para habilitar a consulta ao vivo.</p>;
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Busca ao vivo direto na API do CORP, por nome — encontra o cliente mesmo sem nenhum sinistro. Não grava nada aqui, é só consulta.
      </p>
      <div className="chips" style={{ alignItems: "center" }}>
        <input
          className="inline" style={{ minWidth: 260 }} placeholder="Nome do cliente (mín. 4 letras)..." value={texto}
          onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
        />
        <button className="btn sec sm" disabled={buscando} onClick={buscar}>{buscando ? "Buscando..." : "🔍 Buscar cliente no CORP"}</button>
      </div>
      {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erro}</div>}
      {resultados && (
        resultados.length ? (
          <div style={{ overflow: "auto", marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>CPF/CNPJ</th><th>E-mail</th><th>Telefone</th><th>Cidade/UF</th><th>Situação</th>
                  <th>Detalhes</th><th>Importar p/ Cliente</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((c, i) => {
                  const chave = `${c.codfil}|${c.codigo}`;
                  const det = detalhes[chave];
                  const imp = importados[chave];
                  return (
                    <Fragment key={chave + i}>
                      <tr>
                        <td className="nome-cliente">{c.nome || "—"}</td>
                        <td className="mono">{c.cpf_cnpj || "—"}</td>
                        <td>{c.email || "—"}</td>
                        <td className="mono">{c.telefone || "—"}</td>
                        <td>{[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}</td>
                        <td>{c.ativo === "T" || c.ativo === true ? <span className="badge green">Ativo</span> : <span className="badge gray">Inativo</span>}</td>
                        <td>
                          <button className="btn ghost xs" disabled={det && det.carregando} onClick={() => verDetalhes(c)}>
                            {det && det.carregando ? "Buscando..." : det && det.aberto ? "▲ Ocultar" : "🔍 Ver detalhes"}
                          </button>
                          {det && det.erro && <div className="muted" style={{ fontSize: 10.5 }}>{det.erro}</div>}
                        </td>
                        <td>
                          {!imp && <button className="btn ok xs" onClick={() => importar(c)}>⬇ Importar</button>}
                          {imp && imp.status === "importado" && <span className="badge green">✓ Importado</span>}
                          {imp && navigate && <a style={{ marginLeft: 6, fontSize: 12 }} onClick={() => navigate("cliente", imp.clienteId)}>Ver cliente</a>}
                        </td>
                      </tr>
                      {det && det.aberto && det.dados && (
                        <tr>
                          <td colSpan={8} style={{ padding: "6px 0 14px" }}>
                            <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", fontSize: 12.5 }}>
                              <div className="grid c3" style={{ gap: 8 }}>
                                <div><b>Data nasc.:</b> {det.dados.datanas || "—"}</div>
                                <div><b>Profissão:</b> {det.dados.profissao || "—"}</div>
                                <div><b>Estado civil:</b> {det.dados.estado_civil || "—"}</div>
                              </div>
                              {Array.isArray(det.dados.enderecos) && det.dados.enderecos.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                  <b>Endereços</b>
                                  {det.dados.enderecos.map((e, idx) => (
                                    <div key={idx} className="muted">{[e.logradouro, e.numero, e.bairro, e.cidade, e.estado, e.cep].filter(Boolean).join(", ")}</div>
                                  ))}
                                </div>
                              )}
                              {Array.isArray(det.dados.telefones) && det.dados.telefones.length > 0 && (
                                <div style={{ marginTop: 6 }}><b>Telefones:</b> {det.dados.telefones.join(", ")}</div>
                              )}
                              {Array.isArray(det.dados.emails) && det.dados.emails.length > 0 && (
                                <div style={{ marginTop: 6 }}><b>E-mails:</b> {det.dados.emails.join(", ")}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Nenhum cliente encontrado no CORP para esse termo.</p>
      )}
    </div>
  );
}
