import { Fragment, useState } from "react";
import { buscarClientes, buscarClienteDetalhado, buscarLigacoesCliente, mapearLigacoesCliente, fetchDocumento, extractUrlApolice, extractDocumentoDetalhado } from "../logic/corpApi";
import { clienteIdFromNome, clienteClaims } from "../logic/clientes";
import { uid } from "../logic/format";

// A documentação do CORP mostra emails/telefones/contatos como lista de
// texto puro, mas a API real devolve objetos (ex.: telefone com ddd+numero
// separados) — sem isso, `.join(", ")` direto vira "[object Object]" na
// tela. Tenta os campos mais prováveis; sem achar nenhum, cai no primeiro
// valor de texto do objeto, pra nunca mostrar lixo.
function textoDe(item) {
  if (item == null) return "";
  if (typeof item !== "object") return String(item);
  if (item.email) return String(item.email);
  if (item.numero) return (item.ddd ? `(${item.ddd}) ` : "") + item.numero;
  if (item.nome) return item.nome + (item.cargo ? ` — ${item.cargo}` : "");
  const v = Object.values(item).find((x) => typeof x === "string" && x.trim());
  return v || "";
}
function fmtBRL(v) { return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

// Busca CLIENTE ao vivo no CORP (GET /clientes?texto=) — a pedido do
// usuário: a consulta por sinistro (ConsultaCorpBox.jsx) só encontrava
// quem já tinha processo; essa busca direta encontra qualquer cliente
// cadastrado no CORP, com ou sem sinistro. Não grava nada sozinha — só o
// botão "Importar" grava, e só o registro escolhido.
export function ConsultaClienteCorpBox({ config, clienteActions, navigate, claims, overrides }) {
  const cfg = config.corp_cfg || {};
  const configurado = !!(cfg.url && cfg.email);
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [detalhes, setDetalhes] = useState({});
  const [ligacoes, setLigacoes] = useState({});
  const [apolices, setApolices] = useState({});
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

    // Apólices/documentos do cliente, de DUAS fontes combinadas:
    // 1) GET /cliente_ligacoes?codigo= — nem sempre confiável: o "codigo" da
    //    busca por nome (/clientes) é um id diferente do que o CORP usa pra
    //    vincular documentos, então às vezes volta vazio mesmo pra cliente
    //    com apólice de verdade (visto depurando ao vivo com o usuário).
    // 2) Sinistros JÁ sincronizados aqui pro mesmo nome (mesmo mecanismo que
    //    já funciona 100% na tela de Sinistro): cada um guarda seu próprio
    //    codfil+nosnum, então dá pra buscar o documento direto em
    //    /documento sem precisar descobrir nada — e essa chamada já traz a
    //    URL da apólice de graça (extractDocumentoDetalhado), sem precisar
    //    de uma segunda busca via buscarApolice.
    setLigacoes((s) => ({ ...s, [chave]: { carregando: true } }));
    const paresLocais = [];
    const vistoLocal = new Set();
    clienteClaims(claims, overrides, c.nome).forEach((cl) => {
      if (!cl.codfil || !cl.nosnum) return;
      const k = `${cl.codfil}|${cl.nosnum}`;
      if (!vistoLocal.has(k)) { vistoLocal.add(k); paresLocais.push({ codfil: cl.codfil, nosnum: cl.nosnum }); }
    });

    Promise.allSettled([
      buscarLigacoesCliente(cfg, c.codigo).then(mapearLigacoesCliente),
      Promise.all(paresLocais.map((p) => fetchDocumento(cfg, p.codfil, p.nosnum).then(extractDocumentoDetalhado).catch(() => null))),
    ]).then(([resLigacoes, resLocais]) => {
      const doCorp = resLigacoes.status === "fulfilled" ? resLigacoes.value : [];
      const doLocal = (resLocais.status === "fulfilled" ? resLocais.value : []).filter(Boolean);
      const vistos = new Set(doCorp.map((d) => `${d.codfil}|${d.nosnum}`));
      const todos = [...doCorp, ...doLocal.filter((d) => !vistos.has(`${d.codfil}|${d.nosnum}`))];
      const erro = !todos.length && resLigacoes.status === "rejected" ? resLigacoes.reason.message : null;
      setLigacoes((s) => ({ ...s, [chave]: { carregando: false, docs: todos, erro } }));
      todos.forEach((doc) => {
        if (doc.urlApolice) {
          const chaveDoc = `${doc.codfil}|${doc.nosnum}`;
          setApolices((s) => ({ ...s, [chaveDoc]: { carregando: false, url: doc.urlApolice } }));
          anexarApoliceSeNecessario(c, doc, doc.urlApolice);
        } else {
          buscarApolice(c, doc, { abrirNovaAba: false });
        }
      });
    });
  }

  // Vincula automaticamente a URL da apólice ao cadastro do cliente (sem
  // precisar ter clicado "Importar" antes — o clienteId é derivado só do
  // nome), evitando duplicar o mesmo anexo se já tiver sido vinculado antes.
  function anexarApoliceSeNecessario(c, doc, url) {
    const nome = String(c.nome || "").trim();
    if (!nome) return;
    const clienteId = clienteIdFromNome(nome);
    const jaTem = ((clienteActions.clientes[clienteId] || {}).anexos || []).some((a) => a.url === url);
    if (!jaTem) {
      const nomeAnexo = "Apólice" + (doc.numeroApolice ? ` ${doc.numeroApolice}` : "") + (doc.seguradora ? ` — ${doc.seguradora}` : "");
      clienteActions.addAnexo(clienteId, { id: uid("anx"), nome: nomeAnexo, url, adicionadoEm: new Date().toISOString() });
    }
  }

  // Busca a URL assinada do PDF (fetchDocumento, mesmo usado na consulta
  // por sinistro) pra 1 documento e já anexa no cadastro do cliente (não
  // precisa ter clicado "Importar" antes — o clienteId é derivado só do
  // nome). `abrirNovaAba` só é true num clique direto do usuário — o
  // navegador bloqueia popup aberto fora de uma interação, então a busca
  // automática (ver verDetalhes) nunca tenta abrir aba sozinha.
  function buscarApolice(c, doc, { abrirNovaAba }) {
    const chaveDoc = `${doc.codfil}|${doc.nosnum}`;
    setApolices((s) => ({ ...s, [chaveDoc]: { carregando: true } }));
    fetchDocumento(cfg, doc.codfil, doc.nosnum)
      .then((resp) => {
        const url = extractUrlApolice(resp);
        setApolices((s) => ({ ...s, [chaveDoc]: { carregando: false, url: url || null, erro: url ? null : "Nenhuma apólice encontrada para este documento." } }));
        if (url) {
          if (abrirNovaAba) window.open(url, "_blank", "noreferrer");
          anexarApoliceSeNecessario(c, doc, url);
        }
      })
      .catch((e) => setApolices((s) => ({ ...s, [chaveDoc]: { carregando: false, erro: e.message } })));
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
    const telefone = dados.telefone || textoDe((Array.isArray(dados.telefones) && dados.telefones[0]) || null);
    const email = dados.email || textoDe((Array.isArray(dados.emails) && dados.emails[0]) || null);
    // Campos que o cadastro não tem campo próprio (pessoa física/jurídica,
    // sexo, data nasc., profissão, estado civil, escolaridade) entram como
    // texto em Observações — a pedido do usuário: "adiciona tudo". Anexa no
    // que já existia (nunca sobrescreve uma observação manual anterior).
    const extras = [
      dados.pessoa && `Pessoa: ${dados.pessoa === "F" ? "Física" : dados.pessoa === "J" ? "Jurídica" : dados.pessoa}`,
      dados.sexo && `Sexo: ${dados.sexo}`,
      dados.datanas && `Data nasc.: ${dados.datanas}`,
      dados.profissao && `Profissão: ${dados.profissao}`,
      dados.estado_civil && `Estado civil: ${dados.estado_civil}`,
      dados.escolaridade && `Escolaridade: ${dados.escolaridade}`,
    ].filter(Boolean).join(" | ");
    const observacoesCorp = [dados.observacoes, extras].filter(Boolean).join(" | ");
    const existente = clienteActions.clientes[clienteId] || {};
    const observacoes = [existente.observacoes, observacoesCorp ? `[CORP] ${observacoesCorp}` : ""].filter(Boolean).join("\n");
    clienteActions.saveCadastro(clienteId, {
      nome,
      documento: dados.cpf_cnpj || "",
      endereco,
      observacoes,
      contatos: [{ nome, telefone, email, cargo: "" }],
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
                                <div><b>Pessoa:</b> {det.dados.pessoa === "F" ? "Física" : det.dados.pessoa === "J" ? "Jurídica" : (det.dados.pessoa || "—")}</div>
                                <div><b>Sexo:</b> {det.dados.sexo || "—"}</div>
                                <div><b>Data nasc.:</b> {det.dados.datanas || "—"}</div>
                                <div><b>Profissão:</b> {det.dados.profissao || "—"}</div>
                                <div><b>Estado civil:</b> {det.dados.estado_civil || "—"}</div>
                                <div><b>Escolaridade:</b> {det.dados.escolaridade || "—"}</div>
                              </div>
                              {det.dados.observacoes && (
                                <div style={{ marginTop: 8 }}><b>Observações:</b> {det.dados.observacoes}</div>
                              )}
                              {Array.isArray(det.dados.enderecos) && det.dados.enderecos.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                  <b>Endereços</b>
                                  {det.dados.enderecos.map((e, idx) => (
                                    <div key={idx} className="muted">{[e.logradouro, e.numero, e.bairro, e.cidade, e.estado, e.cep].filter(Boolean).join(", ")}</div>
                                  ))}
                                </div>
                              )}
                              {Array.isArray(det.dados.telefones) && det.dados.telefones.length > 0 && (
                                <div style={{ marginTop: 6 }}><b>Telefones:</b> {det.dados.telefones.map(textoDe).filter(Boolean).join(", ") || "—"}</div>
                              )}
                              {Array.isArray(det.dados.emails) && det.dados.emails.length > 0 && (
                                <div style={{ marginTop: 6 }}><b>E-mails:</b> {det.dados.emails.map(textoDe).filter(Boolean).join(", ") || "—"}</div>
                              )}
                              {Array.isArray(det.dados.contatos) && det.dados.contatos.length > 0 && (
                                <div style={{ marginTop: 6 }}><b>Contatos:</b> {det.dados.contatos.map(textoDe).filter(Boolean).join(", ") || "—"}</div>
                              )}

                              <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                                <b>Apólices / documentos do cliente</b>
                                {(!ligacoes[chave] || ligacoes[chave].carregando) && <div className="muted">Buscando...</div>}
                                {ligacoes[chave] && ligacoes[chave].erro && <div style={{ color: "var(--danger)" }}>{ligacoes[chave].erro}</div>}
                                {ligacoes[chave] && ligacoes[chave].docs && !ligacoes[chave].docs.length && (
                                  <div className="muted">Nenhuma apólice/documento encontrado pra este cliente.</div>
                                )}
                                {ligacoes[chave] && ligacoes[chave].docs && ligacoes[chave].docs.length > 0 && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                                    {ligacoes[chave].docs.map((doc, di) => {
                                      const chaveDoc = `${doc.codfil}|${doc.nosnum}`;
                                      const ap = apolices[chaveDoc];
                                      return (
                                        <div key={chaveDoc + di} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "var(--card)" }}>
                                          <div className="grid c3" style={{ gap: 6 }}>
                                            <div><b>Apólice:</b> {doc.numeroApolice || "—"}{doc.numeroEndosso && doc.numeroEndosso !== "0" ? ` (end. ${doc.numeroEndosso})` : ""}</div>
                                            <div><b>Nosnum:</b> <span className="mono">{doc.codfil}/{doc.nosnum}</span></div>
                                            <div><b>Tipo:</b> {doc.tipoDocumento || "—"}</div>
                                            <div><b>Seguradora:</b> {doc.seguradora || "—"}</div>
                                            <div><b>Ramo:</b> {doc.ramo || "—"}{doc.categoriaItem ? ` (${doc.categoriaItem})` : ""}</div>
                                            <div><b>Vigência:</b> {doc.vigenciaInicio || "—"} a {doc.vigenciaFim || "—"}</div>
                                          </div>
                                          {doc.motivoEndosso && <div style={{ marginTop: 4 }}><b>Motivo do endosso:</b> {doc.motivoEndosso}</div>}
                                          <div className="grid c3" style={{ gap: 6, marginTop: 8 }}>
                                            <div><b>Valor total:</b> {fmtBRL(doc.valorTotal)} {doc.numeroParcelas ? `(${doc.numeroParcelas}x)` : ""}</div>
                                            <div><b>Valor líquido:</b> {fmtBRL(doc.valorLiquido)}</div>
                                            <div><b>IOF:</b> {fmtBRL(doc.valorIof)}</div>
                                            <div><b>Adicional fracionamento:</b> {fmtBRL(doc.valorAdicionalFracionamento)}</div>
                                            <div><b>Desconto:</b> {fmtBRL(doc.valorDesconto)}</div>
                                            <div><b>1ª parcela:</b> {fmtBRL(doc.valorPrimeiraParcela)}</div>
                                          </div>
                                          <div style={{ marginTop: 4 }}><b>Pagamento:</b> {doc.formaPagamento || "—"}</div>
                                          <div style={{ marginTop: 4 }}><b>Situação:</b> {doc.situacaoAcompanhamento || "—"}</div>
                                          <div style={{ marginTop: 4 }}>
                                            <b>Documento:</b> físico {doc.documentoRecebidoFisico ? "recebido" : "não recebido"}, digital {doc.documentoRecebidoDigital ? "recebido" : "não recebido"}
                                            {doc.dataRecebimentoDocumento ? ` — recebido em ${doc.dataRecebimentoDocumento}` : ""}
                                            {doc.dataEntregaDocumento ? `, entregue em ${doc.dataEntregaDocumento}` : ""}
                                          </div>
                                          {doc.prodDocs.length > 0 && (
                                            <div style={{ marginTop: 4 }}>
                                              <b>Agente/Produtor:</b> {doc.prodDocs.map((p) => p.produtor).filter(Boolean).join(", ") || "—"}
                                            </div>
                                          )}
                                          <div style={{ marginTop: 8 }}>
                                            {ap && ap.carregando ? "Buscando PDF..." : ap && ap.url ? <a href={ap.url} target="_blank" rel="noreferrer" className="btn sec xs">📄 Abrir apólice (PDF)</a> : (
                                              <button className="btn sec xs" onClick={() => buscarApolice(c, doc, { abrirNovaAba: true })}>📄 Ver apólice (PDF)</button>
                                            )}
                                            {ap && ap.erro && <div className="muted" style={{ fontSize: 10.5, marginTop: 4 }}>{ap.erro}</div>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
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
