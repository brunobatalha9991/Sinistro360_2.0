import { useState } from "react";
import { createPortal } from "react-dom";
import { RECORRENCIAS, DIAS_SEMANA, hhmmToMin, minToHHMM, fmtDataBRCurta } from "../../logic/agenda";

// Criar/editar uma ação da Agenda. Num bloco recorrente aberto a partir
// de um dia, o usuário escolhe se a alteração vale "só para este dia"
// (o dia sai da série e vira uma ação avulsa) ou "para toda a série".
// Excluir tem também "deste dia em diante" (encerra a série na véspera).
export function BlocoModal({ bloco, dataDia, presets, onSalvar, onExcluir, onClose }) {
  const existente = !!bloco.id;
  const recorrente = existente && bloco.recorrencia && bloco.recorrencia.tipo !== "nenhuma";
  const [form, setForm] = useState(() => ({
    presetId: bloco.presetId || "",
    titulo: bloco.titulo || "",
    icone: bloco.icone || "",
    cor: bloco.cor || "#2f6bff",
    tipo: bloco.tipo || "acao",
    pausa: !!bloco.pausa,
    inicio: bloco.inicio || "09:00",
    fim: bloco.fim || "09:30",
    lembreteMin: bloco.lembreteMin != null ? bloco.lembreteMin : 5,
    descricao: bloco.descricao || "",
    data: bloco.data || dataDia,
    recorrencia: { tipo: "nenhuma", dias: [1, 2, 3, 4, 5], ate: "", ...(bloco.recorrencia || {}) },
  }));
  const [escopo, setEscopo] = useState(recorrente ? "dia" : "serie");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  function set(patch) { setForm((f) => ({ ...f, ...patch })); }
  function setRec(patch) { setForm((f) => ({ ...f, recorrencia: { ...f.recorrencia, ...patch } })); }

  function escolherPreset(p) {
    if (!p) { set({ presetId: "" }); return; }
    const ini = hhmmToMin(form.inicio);
    set({
      presetId: p.id, titulo: p.nome, icone: p.icone || "", cor: p.cor || "#2f6bff",
      tipo: p.tipo || "acao", pausa: !!p.pausa,
      lembreteMin: p.lembreteMin != null ? p.lembreteMin : 5,
      fim: p.tipo === "marco" ? form.inicio : minToHHMM(ini + (Number(p.duracaoMin) || 30)),
    });
  }

  function toggleDia(d) {
    const dias = form.recorrencia.dias || [];
    setRec({ dias: dias.indexOf(d) >= 0 ? dias.filter((x) => x !== d) : [...dias, d] });
  }

  const marco = form.tipo === "marco";
  const horarioOk = marco || hhmmToMin(form.fim) > hhmmToMin(form.inicio);
  const semanalOk = form.recorrencia.tipo !== "semanal" || (form.recorrencia.dias || []).length > 0;
  const valido = form.titulo.trim() && form.inicio && horarioOk && semanalOk && form.data;

  function salvar() {
    if (!valido) return;
    const rec = form.recorrencia.tipo === "nenhuma"
      ? { tipo: "nenhuma" }
      : { tipo: form.recorrencia.tipo, ...(form.recorrencia.tipo === "semanal" ? { dias: form.recorrencia.dias } : {}), ...(form.recorrencia.ate ? { ate: form.recorrencia.ate } : {}) };
    onSalvar({
      ...form,
      titulo: form.titulo.trim(),
      fim: marco ? form.inicio : form.fim,
      lembreteMin: Number(form.lembreteMin) || 0,
      recorrencia: rec,
    }, escopo);
  }

  const presetsAtivos = presets.filter((p) => p.ativo !== false);

  return createPortal(
    <div className="agenda-modal-fundo" onClick={onClose}>
      <div className="agenda-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <h3 style={{ margin: 0 }}>{existente ? "Editar ação" : "Nova ação"}</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Preset</label>
          <div className="agenda-presets">
            {presetsAtivos.map((p) => (
              <button
                key={p.id} type="button"
                className={"agenda-preset-chip" + (form.presetId === p.id ? " active" : "")}
                style={{ "--bloco-cor": p.cor }} onClick={() => escolherPreset(p)}
              >
                {p.icone} {p.nome}
              </button>
            ))}
            <button type="button" className={"agenda-preset-chip" + (!form.presetId ? " active" : "")} onClick={() => escolherPreset(null)}>
              ✏️ Personalizada
            </button>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "70px 1fr 70px", gap: 10 }}>
          <div className="field">
            <label>Ícone</label>
            <input value={form.icone} maxLength={4} onChange={(e) => set({ icone: e.target.value })} />
          </div>
          <div className="field">
            <label>Título</label>
            <input value={form.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Ex.: Retornar seguradora X" />
          </div>
          <div className="field">
            <label>Cor</label>
            <input type="color" value={form.cor} onChange={(e) => set({ cor: e.target.value })} style={{ padding: 2, height: 36 }} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          <div className="field">
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              <option value="acao">Ação (início e fim)</option>
              <option value="marco">Marco (um horário só)</option>
            </select>
          </div>
          <div className="field">
            <label>{marco ? "Horário" : "Início"}</label>
            <input type="time" value={form.inicio} onChange={(e) => set({ inicio: e.target.value })} />
          </div>
          {!marco && (
            <div className="field">
              <label>Fim</label>
              <input type="time" value={form.fim} onChange={(e) => set({ fim: e.target.value })} />
            </div>
          )}
          <div className="field">
            <label>Lembrete antes</label>
            <select value={form.lembreteMin} onChange={(e) => set({ lembreteMin: Number(e.target.value) })}>
              {[0, 2, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m ? `${m} min` : "Sem lembrete"}</option>)}
            </select>
          </div>
        </div>
        {!horarioOk && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: -8, marginBottom: 10 }}>O fim precisa ser depois do início.</div>}

        <div className="field">
          <label>Detalhes (opcional)</label>
          <textarea rows={2} value={form.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="O que deve ser feito nesta ação" />
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 500, marginBottom: 12 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={form.pausa} onChange={(e) => set({ pausa: e.target.checked })} />
          É uma pausa (almoço, café) — fica fora do tempo produtivo nos indicadores
        </label>

        {(!existente || escopo === "serie") && (
          <div className="agenda-modal-secao">
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <div className="field">
                <label>Repetição</label>
                <select value={form.recorrencia.tipo} onChange={(e) => setRec({ tipo: e.target.value })}>
                  {RECORRENCIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{form.recorrencia.tipo === "nenhuma" ? "Data" : "Começa em"}</label>
                <input type="date" value={form.data} onChange={(e) => set({ data: e.target.value })} />
              </div>
              {form.recorrencia.tipo !== "nenhuma" && (
                <div className="field">
                  <label>Termina em (opcional)</label>
                  <input type="date" value={form.recorrencia.ate || ""} onChange={(e) => setRec({ ate: e.target.value })} />
                </div>
              )}
            </div>
            {form.recorrencia.tipo === "semanal" && (
              <div className="chips" style={{ marginBottom: 6 }}>
                {DIAS_SEMANA.map(([d, l]) => (
                  <div key={d} className={"chip-btn" + ((form.recorrencia.dias || []).indexOf(d) >= 0 ? " active" : "")} onClick={() => toggleDia(d)}>{l}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {recorrente && (
          <div className="agenda-modal-secao">
            <label>Esta ação se repete. Aplicar a alteração a:</label>
            <div className="chips" style={{ marginBottom: 0 }}>
              <div className={"chip-btn" + (escopo === "dia" ? " active" : "")} onClick={() => setEscopo("dia")}>Só {fmtDataBRCurta(dataDia)}</div>
              <div className={"chip-btn" + (escopo === "serie" ? " active" : "")} onClick={() => setEscopo("serie")}>Toda a série</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 16, flexWrap: "wrap" }}>
          <div>
            {existente && !confirmarExclusao && (
              <button type="button" className="btn ghost sm" style={{ color: "var(--danger)", borderColor: "rgba(var(--danger-rgb),.4)" }} onClick={() => setConfirmarExclusao(true)}>Excluir</button>
            )}
            {existente && confirmarExclusao && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 12 }}>Excluir:</span>
                {recorrente ? (
                  <>
                    <button type="button" className="btn danger xs" onClick={() => onExcluir("dia")}>Só este dia</button>
                    <button type="button" className="btn danger xs" onClick={() => onExcluir("diante")}>Deste dia em diante</button>
                    <button type="button" className="btn danger xs" onClick={() => onExcluir("serie")}>Toda a série</button>
                  </>
                ) : (
                  <button type="button" className="btn danger xs" onClick={() => onExcluir("serie")}>Confirmar exclusão</button>
                )}
                <button type="button" className="btn sec xs" onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
              </div>
            )}
          </div>
          <button type="button" className="btn sm" disabled={!valido} onClick={salvar}>Salvar</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
