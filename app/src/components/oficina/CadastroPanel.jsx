import { useState } from "react";

function contatoVazio() { return { nome: "", telefone: "", cargo: "" }; }

// Cadastro manual da oficina (CNPJ, endereço, contatos, seguradoras
// referenciadas) — inteiramente próprio do Sinistro360, nunca vindo da API
// (que só traz o nome como texto livre em cada sinistro), então nunca é
// perdido numa sincronização (ver src/data/schema.js).
export function CadastroPanel({ oficinaId, cadastro, actions, canEdit }) {
  const [cnpj, setCnpj] = useState(cadastro.cnpj || "");
  const [endereco, setEndereco] = useState(cadastro.endereco || "");
  const [observacoes, setObservacoes] = useState(cadastro.observacoes || "");
  const [contatos, setContatos] = useState(cadastro.contatos && cadastro.contatos.length ? cadastro.contatos : [contatoVazio()]);
  const [seguradoraNova, setSeguradoraNova] = useState("");
  const seguradoras = cadastro.seguradorasReferenciadas || [];

  function bloquear() { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); }

  function salvar() {
    if (!canEdit) return bloquear();
    actions.saveCadastro(oficinaId, {
      cnpj: cnpj.trim(), endereco: endereco.trim(), observacoes: observacoes.trim(),
      contatos: contatos.filter((c) => c.nome.trim() || c.telefone.trim()),
    });
    alert("Cadastro salvo.");
  }
  function addSeguradora() {
    if (!canEdit) return bloquear();
    const v = seguradoraNova.trim();
    if (!v || seguradoras.includes(v)) return;
    actions.saveCadastro(oficinaId, { seguradorasReferenciadas: [...seguradoras, v] });
    setSeguradoraNova("");
  }
  function removerSeguradora(nome) {
    if (!canEdit) return bloquear();
    actions.saveCadastro(oficinaId, { seguradorasReferenciadas: seguradoras.filter((s) => s !== nome) });
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Cadastro da oficina</h3>
      <div className="grid c2">
        <div className="field"><label>CNPJ</label><input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
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

      <div style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Seguradoras que referenciam esta oficina</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {seguradoras.length ? seguradoras.map((s) => (
            <span key={s} className="badge blue">{s} <a onClick={() => removerSeguradora(s)} style={{ marginLeft: 4, cursor: "pointer" }}>✕</a></span>
          )) : <span className="muted" style={{ fontSize: 13 }}>Nenhuma seguradora vinculada ainda.</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Nome da seguradora" value={seguradoraNova} onChange={(e) => setSeguradoraNova(e.target.value)} style={{ maxWidth: 260 }} />
          <button className="btn sec sm" onClick={addSeguradora}>+ Adicionar</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Isso é a rede formal de credenciamento — diferente do vínculo "Referenciada/Livre Escolha" registrado em cada sinistro (aba Métricas), que mostra como cada atendimento aconteceu na prática.
        </p>
      </div>
    </div>
  );
}
