import { useState } from "react";
import { uid } from "../../logic/format";

function contatoVazio() { return { nome: "", telefone: "", cargo: "" }; }

// Anexos do cliente (não do processo) — a pedido do usuário: guardar a URL
// da apólice (e outros links) mesmo pra um cliente sem nenhum processo
// vinculado ainda. Alimentado automaticamente pela importação da consulta
// ao CORP (ConsultaCorpBox.jsx) e também editável à mão aqui.
function AnexosCliente({ clienteId, anexos, actions, canEdit }) {
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");

  function adicionar() {
    const u = url.trim();
    if (!u) return;
    actions.addAnexo(clienteId, { id: uid("anx"), nome: nome.trim() || u, url: u, adicionadoEm: new Date().toISOString() });
    setNome(""); setUrl("");
  }
  function remover(a) {
    if (!confirm(`Remover o anexo "${a.nome}"?`)) return;
    actions.removeAnexo(clienteId, a.id);
  }

  return (
    <div style={{ marginTop: 14 }}>
      <label style={{ display: "block", marginBottom: 6 }}>Anexos (apólices, documentos, links)</label>
      {!anexos.length ? (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>Nenhum anexo ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {anexos.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
              <a href={a.url} target="_blank" rel="noreferrer">{a.nome}</a>
              {canEdit && <a style={{ color: "var(--danger)", cursor: "pointer", fontSize: 12 }} onClick={() => remover(a)}>✕ Remover</a>}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="grid c3" style={{ alignItems: "end" }}>
          <div className="field"><label>Nome (opcional)</label><input placeholder="Ex.: Apólice residencial" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="field"><label>Link</label><input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <button type="button" className="btn sec sm" onClick={adicionar}>+ Adicionar anexo</button>
        </div>
      )}
    </div>
  );
}

// Cadastro manual do cliente (CPF/CNPJ, endereço, contatos) — inteiramente
// próprio do Sinistro360, nunca vindo da API (que só traz o nome como
// texto livre em cada sinistro), então nunca é perdido numa sincronização
// (ver src/data/schema.js).
export function CadastroPanel({ clienteId, cadastro, actions, canEdit }) {
  const [documento, setDocumento] = useState(cadastro.documento || "");
  const [endereco, setEndereco] = useState(cadastro.endereco || "");
  const [observacoes, setObservacoes] = useState(cadastro.observacoes || "");
  const [contatos, setContatos] = useState(cadastro.contatos && cadastro.contatos.length ? cadastro.contatos : [contatoVazio()]);

  function salvar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    actions.saveCadastro(clienteId, {
      documento: documento.trim(), endereco: endereco.trim(), observacoes: observacoes.trim(),
      contatos: contatos.filter((c) => c.nome.trim() || c.telefone.trim()),
    });
    alert("Cadastro salvo.");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Cadastro do cliente</h3>
      <div className="grid c2">
        <div className="field"><label>CPF / CNPJ</label><input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="000.000.000-00 ou 00.000.000/0000-00" /></div>
        <div className="field"><label>Endereço</label><input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade/UF" /></div>
      </div>
      <div className="field"><label>Observações</label><textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Contatos</label>
        {contatos.map((ct, i) => (
          <div key={i} className="grid c3" style={{ marginBottom: 6 }}>
            <input placeholder="Nome" value={ct.nome} onChange={(e) => setContatos((cur) => cur.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
            <input placeholder="Telefone" value={ct.telefone} onChange={(e) => setContatos((cur) => cur.map((x, j) => (j === i ? { ...x, telefone: e.target.value } : x)))} />
            <input placeholder="Cargo" value={ct.cargo} onChange={(e) => setContatos((cur) => cur.map((x, j) => (j === i ? { ...x, cargo: e.target.value } : x)))} />
          </div>
        ))}
        <button className="btn sec xs" onClick={() => setContatos((cur) => [...cur, contatoVazio()])}>+ Adicionar contato</button>
      </div>

      <button className="btn" style={{ marginTop: 14 }} onClick={salvar}>Salvar cadastro</button>

      <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 4 }}>
        <AnexosCliente clienteId={clienteId} anexos={cadastro.anexos || []} actions={actions} canEdit={canEdit} />
      </div>
    </div>
  );
}
