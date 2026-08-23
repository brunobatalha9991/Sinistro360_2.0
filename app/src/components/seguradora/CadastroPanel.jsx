import { useState } from "react";

function contatoVazio() { return { nome: "", telefone: "", cargo: "" }; }

// Cadastro manual da seguradora (CNPJ, endereço, contatos) — inteiramente
// próprio do Sinistro360, nunca vindo da API (que só traz o nome como
// texto livre em cada sinistro), então nunca é perdido numa sincronização
// (ver src/data/schema.js). Diferente do Cadastro de Oficinas, não tem a
// lista manual de "seguradoras que referenciam" — aqui o cruzamento
// Referenciada/Livre Escolha por oficina já aparece calculado na aba
// Métricas.
export function CadastroPanel({ seguradoraId, cadastro, actions, canEdit }) {
  const [cnpj, setCnpj] = useState(cadastro.cnpj || "");
  const [endereco, setEndereco] = useState(cadastro.endereco || "");
  const [observacoes, setObservacoes] = useState(cadastro.observacoes || "");
  const [contatos, setContatos] = useState(cadastro.contatos && cadastro.contatos.length ? cadastro.contatos : [contatoVazio()]);

  function salvar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    actions.saveCadastro(seguradoraId, {
      cnpj: cnpj.trim(), endereco: endereco.trim(), observacoes: observacoes.trim(),
      contatos: contatos.filter((c) => c.nome.trim() || c.telefone.trim()),
    });
    alert("Cadastro salvo.");
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Cadastro da seguradora</h3>
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
    </div>
  );
}
