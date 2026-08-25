import { useState } from "react";

// Editor dos status de uma etapa — usado em Vistoria, em cada etapa de
// Perda Parcial/Integral e nas etapas de Atendimento. Além de
// editar/excluir/adicionar o nome do status (como antes), cada status agora
// tem: se aparece campo de data e qual o título dele, e se marca a etapa
// como concluída (verde) ou como encerramento negativo (vermelho) — nem
// sempre o nome do status é "Concluído", e pode haver mais de um status pra
// cada caso (a pedido do usuário). Sem nenhuma dessas config, o
// comportamento é o de antes (campo "Data" sempre visível, sem marcação).
// `horaOption` (a pedido do usuário) só é passado como true pelas Etapas de
// Atendimento — jornadas por ramo não ganham essa opção.
export function StatusChipsEditor({ step, onChangeStep, horaOption }) {
  const options = step.statusOptions || [];
  const doneStatuses = step.doneStatuses || [];
  const negativoStatuses = step.negativoStatuses || [];
  const dateByStatus = step.dateByStatus || {};
  const horaByStatus = step.horaByStatus || {};
  const [draft, setDraft] = useState("");

  function editar(i, atual) {
    const nv = prompt("Editar status:", atual);
    if (!nv) return;
    const novo = nv.trim();
    if (!novo || novo === atual) return;
    const next = [...options]; next[i] = novo;
    const patch = { statusOptions: next };
    // Migra a config (data/conclusão/negativo) do nome antigo pro novo, pra
    // não perder o que já estava configurado só porque o texto mudou.
    if (doneStatuses.indexOf(atual) >= 0) patch.doneStatuses = doneStatuses.map((s) => (s === atual ? novo : s));
    if (negativoStatuses.indexOf(atual) >= 0) patch.negativoStatuses = negativoStatuses.map((s) => (s === atual ? novo : s));
    if (dateByStatus[atual]) {
      const nd = { ...dateByStatus }; nd[novo] = nd[atual]; delete nd[atual];
      patch.dateByStatus = nd;
    }
    if (horaByStatus[atual]) {
      const nh = { ...horaByStatus }; nh[novo] = nh[atual]; delete nh[atual];
      patch.horaByStatus = nh;
    }
    onChangeStep(patch);
  }
  function excluir(i) {
    const removido = options[i];
    const patch = { statusOptions: options.filter((_, idx) => idx !== i) };
    if (doneStatuses.indexOf(removido) >= 0) patch.doneStatuses = doneStatuses.filter((s) => s !== removido);
    if (negativoStatuses.indexOf(removido) >= 0) patch.negativoStatuses = negativoStatuses.filter((s) => s !== removido);
    if (dateByStatus[removido]) { const nd = { ...dateByStatus }; delete nd[removido]; patch.dateByStatus = nd; }
    if (horaByStatus[removido]) { const nh = { ...horaByStatus }; delete nh[removido]; patch.horaByStatus = nh; }
    onChangeStep(patch);
  }
  function adicionar() {
    const v = draft.trim();
    if (v) { onChangeStep({ statusOptions: [...options, v] }); setDraft(""); }
  }
  function setMarcacao(status, valor) {
    // valor: "" | "verde" | "vermelho" — nunca os dois ao mesmo tempo pro
    // mesmo status.
    const nd = doneStatuses.filter((s) => s !== status);
    const nn = negativoStatuses.filter((s) => s !== status);
    if (valor === "verde") nd.push(status);
    if (valor === "vermelho") nn.push(status);
    onChangeStep({ doneStatuses: nd, negativoStatuses: nn });
  }
  function setDateConfig(status, patch) {
    const atual = dateByStatus[status] || { show: true, label: "Data" };
    onChangeStep({ dateByStatus: { ...dateByStatus, [status]: { ...atual, ...patch } } });
  }
  function setHoraConfig(status, patch) {
    const atual = horaByStatus[status] || { show: false, label: "Horário" };
    onChangeStep({ horaByStatus: { ...horaByStatus, [status]: { ...atual, ...patch } } });
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
        {options.map((op, i) => {
          const marcacao = doneStatuses.indexOf(op) >= 0 ? "verde" : negativoStatuses.indexOf(op) >= 0 ? "vermelho" : "";
          const dcfg = dateByStatus[op] || { show: true, label: "Data" };
          const hcfg = horaByStatus[op] || { show: false, label: "Horário" };
          return (
            <div key={op + i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className={"badge " + (marcacao === "verde" ? "green" : marcacao === "vermelho" ? "red" : "gray")} style={{ gap: 6 }}>
                  <span>{op}</span>
                  <a onClick={() => editar(i, op)}>✎</a>
                  <a style={{ color: "var(--danger)" }} onClick={() => excluir(i)}>✕</a>
                </span>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, alignItems: "center", fontSize: 12.5 }}>
                <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Marca a etapa como
                  <select className="inline" value={marcacao} onChange={(e) => setMarcacao(op, e.target.value)}>
                    <option value="">— normal —</option>
                    <option value="verde">✓ Concluída (verde)</option>
                    <option value="vermelho">✕ Encerramento negativo (vermelho)</option>
                  </select>
                </label>
                <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={dcfg.show !== false} onChange={(e) => setDateConfig(op, { show: e.target.checked })} />
                  Tem campo de data
                </label>
                {dcfg.show !== false && (
                  <input
                    className="inline" style={{ minWidth: 160 }} placeholder="Título da data (ex.: Data da vistoria)"
                    defaultValue={dcfg.label || "Data"}
                    onBlur={(e) => setDateConfig(op, { label: e.target.value.trim() || "Data" })}
                  />
                )}
                {horaOption && (
                  <>
                    <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="checkbox" checked={!!hcfg.show} onChange={(e) => setHoraConfig(op, { show: e.target.checked })} />
                      Tem campo de horário
                    </label>
                    {hcfg.show && (
                      <input
                        className="inline" style={{ minWidth: 160 }} placeholder="Título do horário (ex.: Previsão de chegada)"
                        defaultValue={hcfg.label || "Horário"}
                        onBlur={(e) => setHoraConfig(op, { label: e.target.value.trim() || "Horário" })}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input className="inline" placeholder="Novo status..." style={{ minWidth: 150 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn sec xs" onClick={adicionar}>+ Status</button>
      </div>
    </>
  );
}
