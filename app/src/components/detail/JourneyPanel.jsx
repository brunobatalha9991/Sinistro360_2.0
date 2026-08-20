import { getAtendTemplate, getRamoTemplate, getComunsSteps, getUserJourney, isAtendimento, STATUS_DEFAULT, getJourneyNotes } from "../../logic/claims";

// Porte 1:1 de journeyPanel() do HTML original.
export function JourneyPanel({ c, overrides, config, actions, canEdit, isAdminUser, navigate }) {
  const atend = isAtendimento(c);
  const templates = config.corp_journey_templates || {};
  const atendTplCfg = config.corp_atendimento_template;
  const tpl = atend ? getAtendTemplate(atendTplCfg) : getRamoTemplate(templates, c.ramo);
  const uj = getUserJourney(overrides, c.id);
  const steps = uj.steps || {};

  function persist(nextUj) {
    if (!canEdit) return;
    actions.saveUserJourney(c.id, nextUj);
  }
  function setCaminho(v) { persist({ ...uj, caminho: v, steps }); }
  function setStepField(stepId, field, value) {
    const sd = { ...(steps[stepId] || { status: "", date: "", note: "" }), [field]: value };
    persist({ ...uj, steps: { ...steps, [stepId]: sd } });
  }

  let lista;
  if (atend) {
    // Se alguma etapa vira "caminho por tipo" (ex.: Tipo de Assistência), a
    // trilha do tipo escolhido substitui o resto do fluxo — não vai mais
    // para Definir caminho/Perda Parcial/Integral. Sem etapa desse tipo,
    // continua igual a antes.
    lista = [];
    let temBranch = false;
    for (const step of tpl.steps || []) {
      lista.push({ ...step, type: "status" });
      if (step.branch) {
        temBranch = true;
        const escolhido = (steps[step.id] || {}).status || "";
        if (escolhido) {
          const trilha = (step.branches && step.branches[escolhido]) || [];
          lista = lista.concat(trilha.map((s) => ({ ...s, type: "status" })));
        }
        break;
      }
    }
    if (!temBranch) {
      lista.push({ id: "caminho", title: "Definir caminho (Perda Parcial / Perda Integral)", type: "caminho" });
      const tplRamoAt = getRamoTemplate(templates, c.ramo);
      if (uj.caminho === "parcial") lista = lista.concat(tplRamoAt.parcial);
      else if (uj.caminho === "integral") lista = lista.concat(tplRamoAt.integral);
    }
  } else {
    lista = getComunsSteps(tpl).map((s) => ({ ...s, type: "status" }));
    lista.push({ id: "caminho", title: "Definir caminho (Perda Parcial / Perda Integral)", type: "caminho" });
    if (uj.caminho === "parcial") lista = lista.concat(tpl.parcial);
    else if (uj.caminho === "integral") lista = lista.concat(tpl.integral);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Jornada do cliente</h3>
        <span className="tag-manual">
          {atend ? "Etapas de Atendimento • preenchimento manual preservado na sincronização" : `Etapas do ramo ${c.ramo || "—"} • preenchimento manual preservado na sincronização`}
        </span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        {atend ? "As etapas são definidas nas Configurações (Atendimento). Aqui você preenche status, datas e observações." : "As etapas são definidas nas Configurações (por ramo). Aqui você preenche status, datas e observações."}
      </p>
      <div className="journey">
        {lista.map((step, idx) => {
          if (step.type === "caminho") {
            return (
              <div className="jstep" key={step.id + idx}>
                <div className={"jdot " + (uj.caminho ? "done" : "")}><span>{uj.caminho ? "✓" : ""}</span></div>
                <div className={"jbody" + (uj.caminho ? " done" : "")}>
                  <div className="jhead"><h4>{step.title}</h4></div>
                  <div className="jrow">
                    <div className="field">
                      <label>Caminho do sinistro</label>
                      <select className="inline" value={uj.caminho || ""} onChange={(e) => setCaminho(e.target.value)}>
                        <option value="">— Selecione —</option>
                        <option value="parcial">Perda Parcial</option>
                        <option value="integral">Perda Integral</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          const opts = step.statusOptions || STATUS_DEFAULT;
          const sd = steps[step.id] || { status: "", date: "", note: "" };
          const done = (sd.status || "").toLowerCase().indexOf("conclu") >= 0;
          return (
            <div className="jstep" key={step.id}>
              <div className={"jdot " + (done ? "done" : sd.status ? "current" : "")}><span>{done ? "✓" : sd.status ? "●" : ""}</span></div>
              <div className={"jbody" + (done ? " done" : "")}>
                <div className="jhead"><h4>{step.title}</h4></div>
                <div className="jrow">
                  <div className="field">
                    <label>Status</label>
                    <select className="inline" style={{ minWidth: 170 }} value={sd.status || ""} onChange={(e) => setStepField(step.id, "status", e.target.value)}>
                      <option value="">— Status —</option>
                      {opts.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Data</label>
                    <input type="date" className="inline" value={sd.date || ""} onChange={(e) => setStepField(step.id, "date", e.target.value)} />
                  </div>
                </div>
                <div className="field" style={{ marginTop: 8 }}>
                  <label>Observação</label>
                  <input defaultValue={sd.note || ""} placeholder="Observação desta etapa..." onBlur={(e) => setStepField(step.id, "note", e.target.value)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <label style={{ margin: 0 }}>Anotações da jornada</label>
          <span className="tag-manual">Preservado na sincronização</span>
        </div>
        <textarea rows={4} placeholder="Anotações gerais sobre a jornada deste processo..." defaultValue={getJourneyNotes(overrides, c.id)} onBlur={(e) => actions.saveJourneyNotes(c.id, e.target.value)} />
      </div>
      {/* NOTA: o original mostrava este atalho baseado num "papel legado"
          (getRole(), uma chave de localStorage separada que nunca era
          atualizada — na prática sempre retornava "admin" pra todo mundo).
          Troquei pelo papel real do usuário logado. */}
      {isAdminUser && (
        <div style={{ marginTop: 8 }}>
          <button className="btn sec sm" onClick={() => navigate("config")}>
            {atend ? "⚙ Editar etapas de Atendimento nas Configurações" : "⚙ Editar etapas deste ramo nas Configurações"}
          </button>
        </div>
      )}
    </div>
  );
}
