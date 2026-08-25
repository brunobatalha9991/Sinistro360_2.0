import { useEffect, useState } from "react";
import {
  getAtendTemplate, getRamoTemplate, getComunsSteps, getOutrosSteps, getUserJourney, isAtendimento, STATUS_DEFAULT, getJourneyNotes,
  stepStatusEhConcluida, stepStatusEhNegativa, stepDateConfig, stepHoraConfig,
} from "../../logic/claims";
import { fmtDateHoraBR } from "../../logic/format";

// Porte 1:1 de journeyPanel() do HTML original, com registro automático
// (a pedido do usuário) de data/hora/usuário da última interação de cada
// etapa, e de data/hora/usuário da conclusão quando o status virar um
// status "concluído" — some de novo se o status deixar de ser conclusão.
export function JourneyPanel({ c, overrides, config, actions, canEdit, isAdminUser, currentUser, navigate }) {
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
  // caminhoDefinidoEm: grava (uma vez só, nunca sobrescrito) quando o
  // caminho foi de fato escolhido — usado pelo módulo Desempenho pra saber
  // o instante em que o processo deixou de ser "Pendente" (ver
  // inicioAndamentoEm em logic/claims.js).
  function setCaminho(v) {
    const next = { ...uj, caminho: v, steps };
    if (v && !uj.caminhoDefinidoEm) next.caminhoDefinidoEm = new Date().toISOString();
    persist(next);
  }
  // Grava o título da etapa junto com o status — situacaoEfetiva() usa isso
  // pra reconhecer etapas como "Encerramento" e "Status da assistência" em
  // processos de Atendimento sem precisar carregar o template inteiro.
  // `step` (quando for mudança de status) é usado só pra checar se o novo
  // valor está na lista de status "concluída" configurada pelo admin.
  function setStepField(stepId, field, value, title, step) {
    const sd = { ...(steps[stepId] || { status: "", date: "", note: "" }), [field]: value };
    if (title) sd.title = title;
    const agora = new Date().toISOString();
    const quem = (currentUser && currentUser.nome) || "—";
    sd.lastInteractionAt = agora;
    sd.lastInteractionBy = quem;
    // Marca quando a etapa recebeu status pela primeira vez — uma vez só,
    // nunca sobrescrito (diferente de lastInteractionAt) — usada pelo
    // módulo Oficinas pra calcular tempo médio de reparo (ver
    // src/logic/oficinas.js).
    if (field === "status" && value && !sd.firstSetAt) {
      sd.firstSetAt = agora;
    }
    if (field === "status") {
      // A cada troca de status, a data (e a hora, quando existir) limpa —
      // o campo (e o título dele, ver stepDateConfig/stepHoraConfig) pode
      // mudar de sentido de um status pro outro, então pede pra preencher
      // de novo em vez de manter um valor que já não corresponde ao status
      // atual.
      sd.date = "";
      sd.hora = "";
      const concluida = stepStatusEhConcluida(step, value);
      const negativa = !concluida && stepStatusEhNegativa(step, value);
      if (concluida || negativa) {
        // concludedAt marca quando a etapa teve UM desfecho, positivo ou
        // negativo — usado pelo módulo Oficinas (tempo médio de reparo) e
        // pelo módulo Desempenho (data do desfecho do processo, ver
        // ultimaEtapaEfetiva em logic/claims.js).
        sd.concludedAt = agora;
        sd.concludedBy = quem;
        // Só exige (e avisa sobre) a data quando este status realmente tem
        // campo de data configurado (ver stepDateConfig) — etapa sem esse
        // campo resolve/minimiza na hora, sem alerta nenhum. O aviso só faz
        // sentido pro desfecho positivo (a redação já assume "concluída").
        if (concluida && stepDateConfig(step, value).show) {
          alert("Etapa concluída — preencha a data de conclusão. A etapa só minimiza automaticamente depois que a data for informada.");
        }
      } else {
        delete sd.concludedAt;
        delete sd.concludedBy;
      }
    }
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
      lista.push({ id: "caminho", title: "Definir caminho (Perda Parcial / Perda Integral / Outros)", type: "caminho" });
      const tplRamoAt = getRamoTemplate(templates, c.ramo);
      if (uj.caminho === "parcial") lista = lista.concat(tplRamoAt.parcial);
      else if (uj.caminho === "integral") lista = lista.concat(tplRamoAt.integral);
      else if (uj.caminho === "outros") lista = lista.concat(getOutrosSteps(tplRamoAt));
    }
  } else {
    lista = getComunsSteps(tpl).map((s) => ({ ...s, type: "status" }));
    lista.push({ id: "caminho", title: "Definir caminho (Perda Parcial / Perda Integral / Outros)", type: "caminho" });
    if (uj.caminho === "parcial") lista = lista.concat(tpl.parcial);
    else if (uj.caminho === "integral") lista = lista.concat(tpl.integral);
    else if (uj.caminho === "outros") lista = lista.concat(getOutrosSteps(tpl));
  }

  // Etapa atual = a primeira ainda sem desfecho (mesmo critério de
  // currentStage() em logic/claims.js, reaproveitado aqui localmente pra
  // decidir qual etapa abrir sozinha por padrão). Etapa "caminho" conta como
  // sem desfecho até um caminho ser escolhido; etapa "caminho por tipo"
  // (branch) conta como resolvida assim que qualquer opção for escolhida,
  // independente de bater com status "concluída" configurado. Etapa com
  // status "concluída" (verde) só conta como resolvida (e só minimiza
  // sozinha) depois que a data de conclusão for preenchida — MAS só quando
  // esse status realmente tem campo de data configurado (stepDateConfig);
  // sem campo de data, resolve na hora, igual encerramento negativo
  // (vermelho), que nunca exige data.
  function stepResolvida(step) {
    if (step.type === "caminho") return !!uj.caminho;
    const sd = steps[step.id] || {};
    if (step.branch) return !!sd.status;
    if (stepStatusEhConcluida(step, sd.status)) {
      return !stepDateConfig(step, sd.status).show || !!(sd.date && sd.date.trim());
    }
    return stepStatusEhNegativa(step, sd.status);
  }
  let currentIdx = lista.findIndex((step) => !stepResolvida(step));
  if (currentIdx < 0) currentIdx = lista.length - 1;

  function buildOpenMap() {
    const m = {};
    lista.forEach((step, idx) => { m[step.id] = idx === currentIdx; });
    return m;
  }
  const [openMap, setOpenMap] = useState(buildOpenMap);
  // Sempre que a etapa atual muda (ex.: usuário concluiu a etapa e a
  // jornada avançou), reabre só a nova etapa atual — mantendo aberto apenas
  // uma de cada vez, como pedido. Não reage a outras edições (nota, data)
  // que não mudam qual etapa é a atual, então não fecha nada que o usuário
  // tenha aberto manualmente por curiosidade.
  useEffect(() => {
    setOpenMap(buildOpenMap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);
  function toggle(stepId) { setOpenMap((m) => ({ ...m, [stepId]: !m[stepId] })); }

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
        {" "}Só a etapa atual vem aberta — use o botão de cada etapa para ver ou esconder os detalhes das outras.
      </p>
      <div className="journey">
        {lista.map((step, idx) => {
          const open = !!openMap[step.id];
          if (step.type === "caminho") {
            const done = !!uj.caminho;
            return (
              <div className="jstep" key={step.id + idx}>
                <div className={"jdot " + (done ? "done" : "")}><span>{done ? "✓" : ""}</span></div>
                <div className={"jbody" + (done ? " done" : "")}>
                  <div className="jhead">
                    <h4>{step.title}</h4>
                    <button type="button" className="btn sec xs" onClick={() => toggle(step.id)}>{open ? "▾ Ocultar detalhes" : "▸ Ver detalhes"}</button>
                  </div>
                  {open && (
                    <div className="jrow">
                      <div className="field">
                        <label>Caminho do sinistro</label>
                        <select className="inline" value={uj.caminho || ""} onChange={(e) => setCaminho(e.target.value)}>
                          <option value="">— Selecione —</option>
                          <option value="parcial">Perda Parcial</option>
                          <option value="integral">Perda Integral</option>
                          <option value="outros">Outros</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          const opts = step.statusOptions || STATUS_DEFAULT;
          const sd = steps[step.id] || { status: "", date: "", note: "" };
          const done = stepStatusEhConcluida(step, sd.status);
          const negativo = !done && stepStatusEhNegativa(step, sd.status);
          const dateCfg = stepDateConfig(step, sd.status);
          const horaCfg = stepHoraConfig(step, sd.status);
          return (
            <div className="jstep" key={step.id}>
              <div className={"jdot " + (done ? "done" : negativo ? "negativo" : sd.status ? "current" : "")}>
                <span>{done ? "✓" : negativo ? "✕" : sd.status ? "●" : ""}</span>
              </div>
              <div className={"jbody" + (done ? " done" : negativo ? " negativo" : "")}>
                <div className="jhead">
                  <h4>{step.title}</h4>
                  <button type="button" className="btn sec xs" onClick={() => toggle(step.id)}>{open ? "▾ Ocultar detalhes" : "▸ Ver detalhes"}</button>
                </div>
                {open && (
                  <>
                    <div className="jrow">
                      <div className="field">
                        <label>Status</label>
                        <select className="inline" style={{ minWidth: 170 }} value={sd.status || ""} onChange={(e) => setStepField(step.id, "status", e.target.value, step.title, step)}>
                          <option value="">— Status —</option>
                          {opts.map((op) => <option key={op} value={op}>{op}</option>)}
                        </select>
                      </div>
                      {dateCfg.show && (
                        <div className="field">
                          <label>{dateCfg.label}</label>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input type="date" className="inline" value={sd.date || ""} onChange={(e) => setStepField(step.id, "date", e.target.value)} />
                            {!done && (
                              <button
                                type="button" className={"btn xs" + (sd.foraDoPrazo ? "" : " sec")}
                                title="Marcar/desmarcar esta etapa como fora do prazo"
                                onClick={() => setStepField(step.id, "foraDoPrazo", !sd.foraDoPrazo)}
                              >
                                ⏰ Fora do prazo
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {horaCfg.show && (
                        <div className="field">
                          <label>{horaCfg.label}</label>
                          <input type="time" className="inline" value={sd.hora || ""} onChange={(e) => setStepField(step.id, "hora", e.target.value)} />
                        </div>
                      )}
                    </div>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>Observação / Descrição / Feedback</label>
                      <input defaultValue={sd.note || ""} placeholder="Observação, descrição ou feedback desta etapa..." onBlur={(e) => setStepField(step.id, "note", e.target.value)} />
                    </div>
                    {sd.lastInteractionAt && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                        Última interação: {fmtDateHoraBR(sd.lastInteractionAt)} por {sd.lastInteractionBy}
                      </div>
                    )}
                    {sd.concludedAt && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                        Concluído em: {fmtDateHoraBR(sd.concludedAt)} por {sd.concludedBy}
                      </div>
                    )}
                  </>
                )}
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
