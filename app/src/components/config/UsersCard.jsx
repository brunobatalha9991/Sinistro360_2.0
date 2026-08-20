import { useState } from "react";
import { ROLE_LABELS, MODULOS_DISPONIVEIS } from "../../data/auth";
import { uid } from "../../logic/format";
import { hashNewPassword } from "../../logic/passwordHash";

const ROLE_ORDER = ["atendente", "analista", "consulta", "admin"];

// Porte 1:1 do card "Usuários do sistema" das Configurações do HTML original.
export function UsersCard({ users, currentUser, saveRecord }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState("atendente");
  const [modSel, setModSel] = useState(() => {
    const sel = {};
    MODULOS_DISPONIVEIS.forEach((m) => { sel[m[0]] = true; });
    return sel;
  });

  function saveUsers(updater) { saveRecord("corp_users", updater); }
  function findByEmail(list, e) {
    const em = String(e || "").trim().toLowerCase();
    return list.find((u) => String(u.email).trim().toLowerCase() === em);
  }

  async function criarUsuario() {
    const n = nome.trim(), e = email.trim(), s = senha.trim();
    if (!n || !e || !s) { alert("Preencha nome, e-mail e senha."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { alert("E-mail inválido."); return; }
    if (findByEmail(users, e)) { alert("Já existe um usuário com este e-mail."); return; }
    const modulos = MODULOS_DISPONIVEIS.map((m) => m[0]).filter((k) => modSel[k]);
    const { senhaSalt, senhaHash } = await hashNewPassword(s);
    saveUsers((current) => [...(current || []), { id: uid("usr"), nome: n, email: e, senhaSalt, senhaHash, role, modulos }]);
    setNome(""); setEmail(""); setSenha("");
  }

  function abrirModulos(u) {
    if (u.role === "admin") { alert("Administrador tem acesso a todos os módulos."); return; }
    const atuais = u.modulos && u.modulos.length ? u.modulos : MODULOS_DISPONIVEIS.map((m) => m[0]);
    const lista = MODULOS_DISPONIVEIS.map((m, i) => `${i + 1} - ${m[1]}${atuais.indexOf(m[0]) >= 0 ? " [ativo]" : ""}`).join("\n");
    const atuaisIdx = atuais.map((k) => MODULOS_DISPONIVEIS.map((m) => m[0]).indexOf(k)).filter((x) => x >= 0).map((x) => x + 1).join(",");
    const esc = prompt(`Digite os NÚMEROS dos módulos que "${u.nome}" pode acessar, separados por vírgula:\n\n${lista}\n\nEx.: 2,5`, atuaisIdx);
    if (esc === null) return;
    const nums = String(esc).split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 1 && n <= MODULOS_DISPONIVEIS.length);
    if (!nums.length) { alert("Selecione ao menos um módulo."); return; }
    const novos = nums.map((n) => MODULOS_DISPONIVEIS[n - 1][0]);
    saveUsers((current) => (current || []).map((x) => (x.id === u.id ? { ...x, modulos: novos } : x)));
    alert(`Módulos de "${u.nome}" atualizados.`);
  }

  async function redefinirSenha(u) {
    const ns = prompt(`Nova senha para "${u.nome}":`, "");
    if (ns === null) return;
    const trimmed = String(ns).trim();
    if (!trimmed) { alert("A senha não pode ficar em branco."); return; }
    const { senhaSalt, senhaHash } = await hashNewPassword(trimmed);
    saveUsers((current) => (current || []).map((x) => {
      if (x.id !== u.id) return x;
      const { senha: _drop, ...rest } = x;
      return { ...rest, senhaSalt, senhaHash };
    }));
    alert(`Senha de "${u.nome}" redefinida com sucesso.`);
  }

  function mudarFuncao(u) {
    const lista = ROLE_ORDER.map((r, i) => `${i + 1} - ${ROLE_LABELS[r]}`).join("\n");
    const esc = prompt(`Escolha a nova função para "${u.nome}":\n\n${lista}\n\nDigite o número (1 a 4):`, "");
    if (esc === null) return;
    const idx = parseInt(String(esc).trim(), 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= ROLE_ORDER.length) { alert("Opção inválida. Digite um número de 1 a 4."); return; }
    const novoRole = ROLE_ORDER[idx];
    if (novoRole === u.role) { alert("O usuário já tem essa função."); return; }
    if (u.role === "admin" && novoRole !== "admin" && users.filter((x) => x.role === "admin").length <= 1) {
      alert("Não é possível rebaixar o último administrador."); return;
    }
    saveUsers((current) => (current || []).map((x) => (x.id === u.id ? { ...x, role: novoRole } : x)));
    alert(`Função de "${u.nome}" alterada para ${ROLE_LABELS[novoRole]}.`);
  }

  async function editar(u) {
    const nn = prompt("Nome completo:", u.nome); if (nn === null) return;
    const ne = prompt("E-mail (login):", u.email); if (ne === null) return;
    const ns = prompt('Nova senha (deixe em branco para manter a senha atual):', ""); if (ns === null) return;
    let nr = prompt("Função (atendente / analista / consulta / admin):", u.role); if (nr === null) return;
    nr = String(nr).trim().toLowerCase();
    if (ROLE_ORDER.indexOf(nr) < 0) { alert("Função inválida."); return; }
    const other = findByEmail(users, ne.trim());
    if (other && other.id !== u.id) { alert("E-mail já usado por outro usuário."); return; }
    const trimmedSenha = String(ns).trim();
    const novaSenha = trimmedSenha ? await hashNewPassword(trimmedSenha) : null;
    saveUsers((current) => (current || []).map((x) => {
      if (x.id !== u.id) return x;
      const base = { id: u.id, nome: nn.trim(), email: ne.trim(), role: nr, modulos: u.modulos };
      if (novaSenha) return { ...base, senhaSalt: novaSenha.senhaSalt, senhaHash: novaSenha.senhaHash };
      return { ...base, senhaSalt: x.senhaSalt, senhaHash: x.senhaHash };
    }));
  }

  async function migrarSenhasAntigas() {
    const pendentes = users.filter((u) => !u.senhaHash && u.senha);
    if (!pendentes.length) { alert("Nenhum usuário com senha antiga pendente — todos já estão migrados."); return; }
    if (!confirm(`Migrar a senha de ${pendentes.length} usuário(s) para o formato protegido agora?`)) return;
    const hashes = {};
    for (const u of pendentes) hashes[u.id] = await hashNewPassword(u.senha);
    saveUsers((current) => (current || []).map((x) => {
      if (!hashes[x.id]) return x;
      const { senha: _drop, ...rest } = x;
      return { ...rest, senhaSalt: hashes[x.id].senhaSalt, senhaHash: hashes[x.id].senhaHash };
    }));
    alert(`${pendentes.length} senha(s) migrada(s) com sucesso.`);
  }

  function remover(u) {
    if (currentUser && currentUser.id === u.id) { alert("Você não pode remover o próprio usuário logado."); return; }
    if (u.role === "admin" && users.filter((x) => x.role === "admin").length <= 1) { alert("Não é possível remover o último administrador."); return; }
    if (confirm(`Remover o usuário "${u.nome}"?`)) saveUsers((current) => (current || []).filter((x) => x.id !== u.id));
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Usuários do sistema</h3>
      <p className="muted">Apenas administradores criam, editam e removem usuários. Atendente e Analista editam processos; Consulta apenas visualiza; Administrador tem acesso total.</p>

      <div className="grid c2">
        <div className="field"><label>Nome completo</label><input placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="field"><label>E-mail (login)</label><input placeholder="email@empresa.com (login)" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Senha</label><input placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        <div className="field"><label>Atribuição (função)</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="atendente">Atendente</option>
            <option value="analista">Analista</option>
            <option value="consulta">Consulta</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Módulos que este usuário pode acessar (Admin sempre vê tudo)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MODULOS_DISPONIVEIS.map((m) => (
            <label key={m[0]} className={"chip-btn" + (modSel[m[0]] ? " active" : "")} style={{ cursor: "pointer" }}
              onClick={() => setModSel((s) => ({ ...s, [m[0]]: !s[m[0]] }))}
            >{m[1]}</label>
          ))}
        </div>
      </div>

      <button className="btn" onClick={criarUsuario}>+ Criar usuário</button>
      {users.some((u) => !u.senhaHash && u.senha) && (
        <button className="btn ghost" style={{ marginLeft: 8 }} onClick={migrarSenhasAntigas}>
          Migrar senhas antigas agora
        </button>
      )}

      <div style={{ overflow: "auto", marginTop: 14 }}>
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Ações</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td className="mono">{u.email}</td>
                <td><span className={"badge " + (u.role === "admin" ? "purple" : u.role === "consulta" ? "gray" : "blue")}>{ROLE_LABELS[u.role]}</span></td>
                <td>
                  <button className="btn ghost xs" style={{ marginRight: 6 }} onClick={() => abrirModulos(u)}>Módulos</button>
                  <button className="btn ghost xs" style={{ marginRight: 6 }} onClick={() => redefinirSenha(u)}>Redefinir senha</button>
                  <button className="btn ghost xs" style={{ marginRight: 6 }} onClick={() => mudarFuncao(u)}>Mudar função</button>
                  <button className="btn sec xs" onClick={() => editar(u)}>Editar</button>
                  <button className="btn danger xs" style={{ marginLeft: 6 }} onClick={() => remover(u)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
