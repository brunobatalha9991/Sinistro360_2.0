import { useEffect, useState } from "react";
import { uid } from "../../logic/format";
import { PRESETS_DEFAULT, MODELOS_DEFAULT, AGENDA_CFG_DEFAULT, agendaPresets, agendaModelos, agendaCfg, hhmmToMin, minToHHMM } from "../../logic/agenda";

// Padronização da Agenda (Administrador/VIP): presets de ação, modelos de
// dia (aplicados de uma vez na agenda de um ou mais usuários) e regras
// gerais (expediente, tolerância, soneca, tamanho mínimo do feedback).
// Mudar um preset NÃO altera as ações já criadas — cada ação guarda sua
// própria cópia de título/cor/ícone, pra a agenda de ninguém mudar sozinha.
// Campo que só grava ao sair (ou Enter): digitar um nome letra por letra
// não pode virar uma gravação no Firebase por tecla.
function CampoAoSair({ value, onSalvar, numero, ...rest }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  function commit() {
    const out = numero ? Math.max(0, Number(v) || 0) : v;
    if (out !== value) onSalvar(out);
  }
  return (
    <input
      {...rest} value={v ?? ""} onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
    />
  );
}

export function AgendaConfigPanel({ config, saveConfig }) {
  return (
    <>
      <PresetsCard config={config} saveConfig={saveConfig} />
      <ModelosCard config={config} saveConfig={saveConfig} />
      <RegrasCard config={config} saveConfig={saveConfig} />
    </>
  );
}

function PresetsCard({ config, saveConfig }) {
  const presets = agendaPresets(config);
  function salvar(next) { saveConfig("corp_agenda_presets", next); }
  function alterar(id, patch) { salvar(presets.map((p) => (p.id === id ? { ...p, ...patch } : p))); }
  function adicionar() {
    salvar([...presets, { id: uid("ap"), nome: "Nova ação", icone: "⭐", cor: "#2f6bff", duracaoMin: 30, lembreteMin: 5, tipo: "acao", pausa: false, ativo: true }]);
  }
  function remover(id) { salvar(presets.filter((p) => p.id !== id)); }
  function mover(i, d) {
    const j = i + d;
    if (j < 0 || j >= presets.length) return;
    const next = presets.slice();
    [next[i], next[j]] = [next[j], next[i]];
    salvar(next);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Presets de ação</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn sec xs" onClick={() => salvar(PRESETS_DEFAULT)}>Restaurar padrão</button>
          <button className="btn xs" onClick={adicionar}>+ Preset</button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Aparecem como atalho ao criar uma ação. Desativar esconde o preset sem apagar as ações que já usam ele.</p>
      <div style={{ overflow: "auto" }}>
        <table className="agenda-tabela-edit">
          <thead>
            <tr>
              <th></th><th>Ícone</th><th>Nome</th><th>Cor</th><th>Duração</th><th>Lembrete</th><th>Tipo</th><th>Pausa</th><th>Ativo</th><th></th>
            </tr>
          </thead>
          <tbody>
            {presets.map((p, i) => (
              <tr key={p.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn ghost xs" onClick={() => mover(i, -1)} title="Subir">↑</button>
                  <button className="btn ghost xs" onClick={() => mover(i, 1)} title="Descer">↓</button>
                </td>
                <td><CampoAoSair value={p.icone || ""} maxLength={4} style={{ width: 50 }} onSalvar={(v) => alterar(p.id, { icone: v })} /></td>
                <td><CampoAoSair value={p.nome} style={{ minWidth: 200 }} onSalvar={(v) => alterar(p.id, { nome: v })} /></td>
                <td><CampoAoSair type="color" value={p.cor || "#2f6bff"} style={{ width: 44, padding: 2, height: 32 }} onSalvar={(v) => alterar(p.id, { cor: v })} /></td>
                <td><CampoAoSair numero type="number" min={0} step={5} value={p.duracaoMin} style={{ width: 70 }} onSalvar={(v) => alterar(p.id, { duracaoMin: v })} /></td>
                <td><CampoAoSair numero type="number" min={0} step={1} value={p.lembreteMin} style={{ width: 60 }} onSalvar={(v) => alterar(p.id, { lembreteMin: v })} /></td>
                <td>
                  <select value={p.tipo} onChange={(e) => alterar(p.id, { tipo: e.target.value })} style={{ width: "auto" }}>
                    <option value="acao">Ação</option>
                    <option value="marco">Marco</option>
                  </select>
                </td>
                <td><input type="checkbox" style={{ width: "auto" }} checked={!!p.pausa} onChange={(e) => alterar(p.id, { pausa: e.target.checked })} /></td>
                <td><input type="checkbox" style={{ width: "auto" }} checked={p.ativo !== false} onChange={(e) => alterar(p.id, { ativo: e.target.checked })} /></td>
                <td><button className="btn ghost xs" style={{ color: "var(--danger)" }} onClick={() => remover(p.id)}>Remover</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>Duração e lembrete em minutos. "Marco" = um horário só (ex.: Fim de expediente), com um único alarme pra marcar como feito.</p>
    </div>
  );
}

function ModelosCard({ config, saveConfig }) {
  const modelos = agendaModelos(config);
  const presets = agendaPresets(config);
  const [abertoId, setAbertoId] = useState(modelos[0] ? modelos[0].id : null);
  function salvar(next) { saveConfig("corp_agenda_modelos", next); }
  function alterarModelo(id, patch) { salvar(modelos.map((m) => (m.id === id ? { ...m, ...patch } : m))); }
  function alterarItem(m, i, patch) {
    alterarModelo(m.id, { itens: m.itens.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  }
  function adicionarItem(m) {
    const ultimo = m.itens[m.itens.length - 1];
    const ini = ultimo ? ultimo.fim : "08:30";
    const p = presets[0] || {};
    alterarModelo(m.id, { itens: [...m.itens, { presetId: p.id, inicio: ini, fim: minToHHMM(hhmmToMin(ini) + (Number(p.duracaoMin) || 30)) }] });
  }
  function novoModelo() {
    const m = { id: uid("am"), nome: "Novo modelo", itens: [] };
    salvar([...modelos, m]);
    setAbertoId(m.id);
  }
  function duplicar(m) {
    const copia = { ...m, id: uid("am"), nome: m.nome + " (cópia)", itens: m.itens.map((it) => ({ ...it })) };
    salvar([...modelos, copia]);
    setAbertoId(copia.id);
  }
  const aberto = modelos.find((m) => m.id === abertoId);
  const porId = {};
  presets.forEach((p) => { porId[p.id] = p; });

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Modelos de dia</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn sec xs" onClick={() => { salvar(MODELOS_DEFAULT); setAbertoId(MODELOS_DEFAULT[0].id); }}>Restaurar padrão</button>
          <button className="btn xs" onClick={novoModelo}>+ Modelo</button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Um dia inteiro planejado, aplicado de uma vez na agenda (botão "Aplicar modelo" na aba Agenda do dia).</p>
      <div className="chips">
        {modelos.map((m) => (
          <div key={m.id} className={"chip-btn" + (m.id === abertoId ? " active" : "")} onClick={() => setAbertoId(m.id)}>{m.nome}</div>
        ))}
      </div>
      {aberto && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
            <div className="field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
              <label>Nome do modelo</label>
              <CampoAoSair value={aberto.nome} onSalvar={(v) => alterarModelo(aberto.id, { nome: v })} />
            </div>
            <button className="btn sec xs" onClick={() => duplicar(aberto)}>Duplicar</button>
            <button className="btn ghost xs" style={{ color: "var(--danger)" }} onClick={() => { salvar(modelos.filter((m) => m.id !== aberto.id)); setAbertoId(null); }}>Excluir modelo</button>
          </div>
          <table className="agenda-tabela-edit">
            <thead><tr><th>Ação</th><th>Início</th><th>Fim</th><th></th></tr></thead>
            <tbody>
              {aberto.itens.map((it, i) => {
                const p = porId[it.presetId];
                return (
                  <tr key={i}>
                    <td>
                      <select value={it.presetId || ""} onChange={(e) => alterarItem(aberto, i, { presetId: e.target.value })}>
                        {!p && <option value="">(preset removido)</option>}
                        {presets.map((x) => <option key={x.id} value={x.id}>{x.icone} {x.nome}</option>)}
                      </select>
                    </td>
                    <td><CampoAoSair type="time" value={it.inicio} onSalvar={(v) => alterarItem(aberto, i, { inicio: v })} /></td>
                    <td>
                      {p && p.tipo === "marco"
                        ? <span className="muted" style={{ fontSize: 12 }}>marco</span>
                        : <CampoAoSair type="time" value={it.fim} onSalvar={(v) => alterarItem(aberto, i, { fim: v })} />}
                    </td>
                    <td><button className="btn ghost xs" style={{ color: "var(--danger)" }} onClick={() => alterarModelo(aberto.id, { itens: aberto.itens.filter((_, k) => k !== i) })}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button className="btn sec xs" onClick={() => adicionarItem(aberto)}>+ Ação no modelo</button>
            <button className="btn ghost xs" onClick={() => alterarModelo(aberto.id, { itens: aberto.itens.slice().sort((a, b) => a.inicio.localeCompare(b.inicio)) })}>Ordenar por horário</button>
          </div>
        </>
      )}
    </div>
  );
}

function RegrasCard({ config, saveConfig }) {
  const cfg = agendaCfg(config);
  function set(patch) { saveConfig("corp_agenda_cfg", { ...cfg, ...patch }); }
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Regras gerais</h3>
        <button className="btn sec xs" onClick={() => saveConfig("corp_agenda_cfg", AGENDA_CFG_DEFAULT)}>Restaurar padrão</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 12 }}>
        <div className="field"><label>Início do expediente</label><CampoAoSair type="time" value={cfg.inicio} onSalvar={(v) => set({ inicio: v })} /></div>
        <div className="field"><label>Fim do expediente</label><CampoAoSair type="time" value={cfg.fim} onSalvar={(v) => set({ fim: v })} /></div>
        <div className="field"><label>Arrastar de quantos em quantos min</label><CampoAoSair numero type="number" min={1} value={cfg.passoMin} onSalvar={(v) => set({ passoMin: Math.max(1, v) })} /></div>
        <div className="field"><label>Tolerância de pontualidade (min)</label><CampoAoSair numero type="number" min={0} value={cfg.toleranciaMin} onSalvar={(v) => set({ toleranciaMin: Math.max(0, v) })} /></div>
        <div className="field"><label>Soneca (min)</label><CampoAoSair numero type="number" min={1} value={cfg.sonecaMin} onSalvar={(v) => set({ sonecaMin: Math.max(1, v) })} /></div>
        <div className="field"><label>Feedback: mínimo de caracteres</label><CampoAoSair numero type="number" min={1} value={cfg.feedbackMinChars} onSalvar={(v) => set({ feedbackMinChars: Math.max(1, v) })} /></div>
      </div>
    </div>
  );
}
