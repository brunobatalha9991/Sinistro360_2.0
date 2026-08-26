import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { StarRating } from "../StarRating.jsx";
import { useAuth } from "../../hooks/useAuth";
import { loadComms, currentStage, allJourneyStages, journeyStageStatusMap, journeyStageLabel } from "../../logic/claims";
import { fmtDateBR, todayISO, txt } from "../../logic/format";
import { generateContent, isGeminiConfigured } from "../../ai/geminiApi.js";
import { takeComsPrefill } from "../../state/comsPrefill";
import { MensagemTemplateModal } from "./MensagemTemplateModal.jsx";

const MEIOS = ["Telefone", "WhatsApp", "E-mail", "Presencial", "Outro"];
const TITULO_AVULSO = "__avulso__";
const CANAL_INTERNA = "Comunicação Interna Corretora";
const CANAL_BADGE = { Cliente: "green", Oficina: "amber", Seguradora: "purple", [CANAL_INTERNA]: "gray" };

function blankBox() {
  return { texto: "", meio: MEIOS[0], aguardandoRetorno: false, limitacaoComunicacao: false, avaliacao: 0, motivoAvaliacao: "" };
}

// Cada caixa nasce oculta (a pedido do usuário: o formulário de registro
// ficava grande demais com as 4 sempre abertas) — "Ver"/"Ocultar" próprios,
// sem depender do componente pai (fecha sozinha ao reabrir o formulário,
// porque desmonta junto com ele). O selo "preenchido" ajuda a lembrar o que
// já foi escrito mesmo com a caixa fechada.
function ComunicacaoBox({ titulo, subtitulo, box, onChange, comAvaliacao, comLimitacao }) {
  const [aberto, setAberto] = useState(false);
  function set(patch) { onChange({ ...box, ...patch }); }
  const preenchido = !!box.texto.trim();
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px" }}>
        <div>
          <b style={{ fontSize: 13 }}>{titulo}</b>
          {subtitulo && <div className="muted" style={{ fontSize: 11.5 }}>{subtitulo}</div>}
          {!aberto && preenchido && <span className="badge green" style={{ marginLeft: 6, fontSize: 10 }}>preenchido</span>}
        </div>
        <button type="button" className="btn sec xs" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar" : "Ver"}</button>
      </div>
      {aberto && (
        <div style={{ padding: "0 12px 12px" }}>
          <select value={box.meio} onChange={(e) => set({ meio: e.target.value })} style={{ width: "auto", marginBottom: 8 }}>
            {MEIOS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <textarea rows={3} placeholder="Descreva a comunicação realizada..." value={box.texto} onChange={(e) => set({ texto: e.target.value })} />
          {comAvaliacao && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
              <StarRating value={box.avaliacao} onChange={(v) => set({ avaliacao: v })} />
              <input placeholder="Motivo da avaliação (opcional)" value={box.motivoAvaliacao} onChange={(e) => set({ motivoAvaliacao: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={box.aguardandoRetorno} onChange={() => set({ aguardandoRetorno: !box.aguardandoRetorno })} />
              Aguardando retorno
            </label>
            {comLimitacao && (
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }} title="Marca essa interação como evidência de limitação de comunicação da oficina — contabilizado no módulo Oficinas">
                <input type="checkbox" checked={box.limitacaoComunicacao} onChange={() => set({ limitacaoComunicacao: !box.limitacaoComunicacao })} />
                Limitação de comunicação
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Quarta caixa — sugestão de mensagem pro cliente, gerada pela mesma
// integração Gemini do Assistente IA (mesma chave/config, sem infra nova).
// Roda só sob clique (nunca automático a cada tecla) e nunca envia nada
// sozinha: o texto fica num campo editável pro usuário revisar e copiar.
function SugestaoClienteBox({ titulo, oficinaTexto, seguradoraTexto }) {
  const [sugestao, setSugestao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const configurado = isGeminiConfigured();

  async function gerar() {
    const contexto = [
      titulo ? `Título/etapa atual do processo: ${titulo}` : "",
      oficinaTexto.trim() ? `Comunicação com a oficina: ${oficinaTexto.trim()}` : "",
      seguradoraTexto.trim() ? `Comunicação com a seguradora: ${seguradoraTexto.trim()}` : "",
    ].filter(Boolean).join("\n");
    if (!contexto) { setErro("Preencha o título e/ou a comunicação com a oficina/seguradora acima antes de gerar a sugestão."); return; }
    setGerando(true); setErro(null); setCopiado(false);
    try {
      const { text } = await generateContent({
        systemInstruction: "Você ajuda um atendente de seguros a redigir uma mensagem curta, clara e cordial para enviar ao cliente sobre o andamento do sinistro, em português do Brasil. Baseie-se só no contexto fornecido, sem inventar informações que não estão nele. Responda só com o texto da mensagem, sem explicações nem saudação de e-mail formal.",
        contents: [{ role: "user", parts: [{ text: `Escreva uma mensagem para o cliente com base neste contexto:\n${contexto}` }] }],
      });
      setSugestao(text);
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  function copiar() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(sugestao).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }).catch(() => {});
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--surface-2)" }}>
      <b style={{ fontSize: 13 }}>Sugestão de mensagem para o cliente</b>
      <p className="muted" style={{ fontSize: 11.5, margin: "4px 0 8px" }}>
        Gerada por IA com base no título e nas comunicações com oficina/seguradora acima — revise antes de enviar, nada é enviado automaticamente.
      </p>
      {!configurado ? (
        <p className="muted" style={{ fontSize: 12 }}>Assistente IA não configurado (chave do Gemini ausente) — este recurso fica indisponível até configurar.</p>
      ) : (
        <>
          <button type="button" className="btn sec sm" onClick={gerar} disabled={gerando}>{gerando ? "Gerando..." : "Gerar sugestão"}</button>
          {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erro}</div>}
          {sugestao && (
            <>
              <textarea rows={3} style={{ marginTop: 8 }} value={sugestao} onChange={(e) => setSugestao(e.target.value)} />
              <button type="button" className="btn sec xs" style={{ marginTop: 6 }} onClick={copiar}>{copiado ? "Copiado!" : "Copiar"}</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Edição de uma comunicação já registrada (a pedido do usuário) — Título/
// Data/Meio/Texto e, quando aplicável, Avaliação. "Aguardando retorno" e
// "Limitação de comunicação" ficam de fora de propósito: eles têm regra
// própria de métrica (ver toggleFlag/comFlagContaComoMetrica em CommsPanel/
// claims.js) e continuam se alterando só pelo clique no selo da lista, pra
// não pular essa regra editando o campo direto aqui. Canal não é editável
// (evita reclassificar uma comunicação de Oficina pra Cliente, por ex.).
function EditarComunicacaoForm({ m, onSalvar, onCancelar }) {
  const [titulo, setTitulo] = useState(m.titulo || "");
  const [data, setData] = useState(m.date || todayISO());
  const [meio, setMeio] = useState(m.meio || MEIOS[0]);
  const [texto, setTexto] = useState(m.text || "");
  const temAvaliacao = typeof m.avaliacao === "number";
  const [avaliacao, setAvaliacao] = useState(m.avaliacao || 0);
  const [motivoAvaliacao, setMotivoAvaliacao] = useState(m.motivoAvaliacao || "");

  function salvar() {
    if (!texto.trim()) { alert("Informe o texto da comunicação."); return; }
    onSalvar({
      titulo: titulo.trim(), date: data, meio, text: texto.trim(),
      ...(temAvaliacao ? { avaliacao, motivoAvaliacao: motivoAvaliacao.trim() } : {}),
    });
  }

  return (
    <div style={{ border: "1px solid var(--brand)", borderRadius: 8, padding: 12, marginTop: 8, background: "var(--surface-2)" }}>
      <div className="grid c2">
        <div className="field"><label>Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div className="field"><label>Data</label><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
      </div>
      <div className="field"><label>Meio</label>
        <select value={meio} onChange={(e) => setMeio(e.target.value)} style={{ width: "auto" }}>
          {MEIOS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="field"><label>Texto</label><textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
      {temAvaliacao && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <StarRating value={avaliacao} onChange={setAvaliacao} />
          <input placeholder="Motivo da avaliação (opcional)" value={motivoAvaliacao} onChange={(e) => setMotivoAvaliacao(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" className="btn xs" onClick={salvar}>Salvar edição</button>
        <button type="button" className="btn ghost xs" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

// Porte 1:1 de commsPanel() do HTML original (histórico de comunicações),
// evoluído a pedido do usuário: quatro caixas fixas (Cliente/Oficina/
// Seguradora/Comunicação Interna Corretora, cada uma com seu próprio Meio,
// e cada uma oculta por padrão — "Ver"/"Ocultar" — pra não sobrecarregar o
// formulário), avaliação em estrelas + motivo em Cliente/Oficina/Seguradora
// (base pra um ranking futuro de desempenho, ainda não construído),
// "Aguardando retorno" nas 4 (pra filtrar depois) e uma última caixa com
// sugestão de mensagem pro cliente via IA. Título e Data ficam
// compartilhados; um único "Registrar" cria uma entrada no histórico pra
// cada caixa preenchida naquele momento. Editar/excluir uma entrada já
// registrada usa a mesma permissão de escrita do resto do processo
// (canEdit — Administrador/Atendente/Analista; Consulta nunca edita nada).
export function CommsPanel({ c, overrides, actions, canEdit, config, clientes }) {
  const { currentUser } = useAuth();
  const [msgModalOpen, setMsgModalOpen] = useState(false);
  // A ferramenta de registro só abre sob clique (a pedido do usuário) —
  // deixa o Histórico já registrado mais visual, sem o formulário sempre
  // ocupando a tela. Fecha sozinha depois de registrar com sucesso.
  const [registrarAberto, setRegistrarAberto] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const list = loadComms(overrides, c.id).slice().reverse();
  const templates = (config && config.corp_journey_templates) || {};
  const atendTemplateCfg = config && config.corp_atendimento_template;
  const statusEtapas = journeyStageStatusMap(overrides, c.id);
  const etapaAtual = journeyStageLabel(currentStage(overrides, templates, atendTemplateCfg, c) || "", statusEtapas);
  const titulosEtapas = allJourneyStages(templates, atendTemplateCfg).map((t) => journeyStageLabel(t, statusEtapas));

  const [data, setData] = useState(todayISO());
  const [titulo, setTitulo] = useState(() => etapaAtual);
  const [tituloAvulso, setTituloAvulso] = useState("");
  // Vem preenchido quando o usuário clica em "Transformar em atualização"
  // num alerta de e-mail (ver DetailHeader.jsx) — pega o prefill só se for
  // deste processo (evita vazar pra outro processo aberto em seguida).
  const [boxCliente, setBoxCliente] = useState(() => {
    const prefill = takeComsPrefill();
    return prefill && prefill.claimId === c.id ? { ...blankBox(), texto: prefill.texto } : blankBox();
  });
  const [boxOficina, setBoxOficina] = useState(blankBox);
  const [boxSeguradora, setBoxSeguradora] = useState(blankBox);
  const [boxCorretora, setBoxCorretora] = useState(blankBox);

  const tituloResolvido = titulo === TITULO_AVULSO ? tituloAvulso.trim() : titulo;

  function registrar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    if (!tituloResolvido) { alert("Selecione ou informe um título para o registro."); return; }
    const candidatos = [
      { canal: "Cliente", box: boxCliente, comAvaliacao: true },
      { canal: "Oficina", box: boxOficina, comAvaliacao: true },
      { canal: "Seguradora", box: boxSeguradora, comAvaliacao: true },
      { canal: CANAL_INTERNA, box: boxCorretora, comAvaliacao: false },
    ];
    const novos = candidatos.filter(({ box }) => box.texto.trim()).map(({ canal, box, comAvaliacao }) => ({
      id: "cm_" + Math.random().toString(36).slice(2, 9), titulo: tituloResolvido, canal, meio: box.meio, date: data,
      text: box.texto.trim(), aguardandoRetorno: !!box.aguardandoRetorno,
      ...(canal === "Oficina" ? { limitacaoComunicacao: !!box.limitacaoComunicacao } : {}),
      ...(comAvaliacao ? { avaliacao: box.avaliacao || 0, motivoAvaliacao: (box.motivoAvaliacao || "").trim() } : {}),
      who: (currentUser && currentUser.nome) || "—", at: new Date().toISOString(),
    }));
    if (!novos.length) { alert("Preencha ao menos uma das comunicações (Cliente, Oficina, Seguradora ou Comunicação Interna Corretora)."); return; }
    const arr = [...loadComms(overrides, c.id), ...novos];
    actions.saveComms(c.id, arr);
    actions.logAudit(c.id, "Comunicação registrada", `${tituloResolvido} — ${novos.map((n) => n.canal).join(", ")}`);
    setBoxCliente(blankBox()); setBoxOficina(blankBox()); setBoxSeguradora(blankBox()); setBoxCorretora(blankBox());
    setTitulo(etapaAtual); setTituloAvulso("");
    setRegistrarAberto(false);
  }
  function excluir(id) {
    // NOTA: o original não checava permissão aqui (só ao criar) — um usuário
    // "consulta" conseguia excluir comunicações pela UI. Adicionei a mesma
    // checagem usada em toda ação de escrita desta tela.
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const arr = loadComms(overrides, c.id).filter((x) => x.id !== id);
    actions.saveComms(c.id, arr);
    actions.logAudit(c.id, "Comunicação excluída", "");
  }
  function salvarEdicao(id, patch) {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const arr = loadComms(overrides, c.id).map((m) => (
      m.id === id ? { ...m, ...patch, editadoPor: (currentUser && currentUser.nome) || "—", editadoEm: new Date().toISOString() } : m
    ));
    actions.saveComms(c.id, arr);
    actions.logAudit(c.id, "Comunicação editada", patch.titulo || "");
    setEditingId(null);
  }

  // "Aguardando retorno" e "Limitação de comunicação" podem ser
  // marcados/desmarcados depois de registrados (a pedido do usuário) — mas
  // perpetuam como indicador/métrica (ver comFlagContaComoMetrica em
  // logic/claims.js): ao marcar, grava `${campo}Desde`; ao desmarcar, só
  // trava `${campo}Metrica` (métrica permanente) se já tinham passado 8h
  // desde a marcação — desmarcado antes disso, não conta como métrica.
  const OITO_HORAS_MS = 8 * 60 * 60 * 1000;
  function toggleFlag(id, campo) {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    const desdeCampo = campo + "Desde";
    const metricaCampo = campo + "Metrica";
    const arr = loadComms(overrides, c.id).map((m) => {
      if (m.id !== id) return m;
      if (!m[campo]) return { ...m, [campo]: true, [desdeCampo]: m[desdeCampo] || new Date().toISOString() };
      const desde = m[desdeCampo] ? new Date(m[desdeCampo]).getTime() : null;
      const decorrido = desde ? Date.now() - desde : 0;
      const patch = { ...m, [campo]: false, [desdeCampo]: null };
      if (desde && decorrido >= OITO_HORAS_MS) patch[metricaCampo] = true;
      return patch;
    });
    actions.saveComms(c.id, arr);
  }

  return (
    <div>
      {canEdit && (
        <>
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ margin: 0 }}>Mensagem para o cliente</h3>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>Templates prontos de WhatsApp, já sugerindo o vinculado à etapa atual da jornada.</p>
            </div>
            <button className="btn sec sm" onClick={() => setMsgModalOpen(true)}>✉ Mensagem para o cliente</button>
          </div>

          {msgModalOpen && (
            <MensagemTemplateModal c={c} overrides={overrides} config={config} clientes={clientes} actions={actions} onClose={() => setMsgModalOpen(false)} />
          )}

          {!registrarAberto ? (
            <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>Registrar comunicação</h3>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>Registra uma nova comunicação com cliente, oficina, seguradora e/ou internamente na corretora.</p>
              </div>
              <button className="btn sm" onClick={() => setRegistrarAberto(true)}>+ Registrar comunicação</button>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0 }}>Registrar comunicação</h3>
                <button className="btn sec xs" onClick={() => setRegistrarAberto(false)}>✕ Fechar</button>
              </div>
              <div className="grid c2">
                <div className="field"><label>Título</label>
                  <select value={titulo} onChange={(e) => setTitulo(e.target.value)}>
                    <option value="">— Selecione —</option>
                    {titulosEtapas.map((et) => <option key={et} value={et}>{et}</option>)}
                    <option value={TITULO_AVULSO}>+ Título avulso...</option>
                  </select>
                  {titulo === TITULO_AVULSO && (
                    <input style={{ marginTop: 6 }} placeholder="Digite o título para esta situação" value={tituloAvulso} onChange={(e) => setTituloAvulso(e.target.value)} />
                  )}
                </div>
                <div className="field"><label>Data</label>
                  <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                <ComunicacaoBox titulo="Comunicação com o Cliente" box={boxCliente} onChange={setBoxCliente} comAvaliacao />
                <ComunicacaoBox titulo="Comunicação com a Oficina" box={boxOficina} onChange={setBoxOficina} comAvaliacao comLimitacao />
                <ComunicacaoBox titulo="Comunicação com a Seguradora" box={boxSeguradora} onChange={setBoxSeguradora} comAvaliacao />
                <ComunicacaoBox titulo={CANAL_INTERNA} subtitulo="Comunicação / Feedback / Observações" box={boxCorretora} onChange={setBoxCorretora} />
                <SugestaoClienteBox titulo={tituloResolvido} oficinaTexto={boxOficina.texto} seguradoraTexto={boxSeguradora.texto} />
              </div>

              <button className="btn" style={{ marginTop: 14 }} onClick={registrar}>Registrar comunicação</button>
            </div>
          )}
        </>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Histórico de comunicações</h3>
          <span className="tag-manual">Registro manual preservado na sincronização</span>
        </div>
        {!list.length ? <EmptyState>Nenhuma comunicação registrada.</EmptyState> : list.map((m) => {
          const editando = editingId === m.id;
          return (
            <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                <div>
                  {m.titulo && <span className="badge blue" style={{ marginRight: 6 }}>{m.titulo}</span>}
                  <span className={"badge " + CANAL_BADGE[m.canal]}>{m.canal}</span>
                  <span
                    className={"badge " + (m.aguardandoRetorno ? "amber" : "gray")} style={{ marginLeft: 6, cursor: canEdit ? "pointer" : "default" }}
                    title={canEdit ? "Clique para marcar/desmarcar" : ""} onClick={() => toggleFlag(m.id, "aguardandoRetorno")}
                  >
                    {m.aguardandoRetorno ? "✓ " : ""}Aguardando retorno
                  </span>
                  {m.canal === "Oficina" && (
                    <span
                      className={"badge " + (m.limitacaoComunicacao ? "red" : "gray")} style={{ marginLeft: 6, cursor: canEdit ? "pointer" : "default" }}
                      title={canEdit ? "Clique para marcar/desmarcar" : ""} onClick={() => toggleFlag(m.id, "limitacaoComunicacao")}
                    >
                      {m.limitacaoComunicacao ? "✓ " : ""}Limitação de comunicação
                    </span>
                  )}
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{m.meio} • {fmtDateBR(m.date)}</span>
                </div>
                {canEdit && !editando && (
                  <span style={{ display: "flex", gap: 6 }}>
                    <button className="btn sec xs" onClick={() => setEditingId(m.id)}>✎ Editar</button>
                    <button className="btn danger xs" onClick={() => excluir(m.id)}>Excluir</button>
                  </span>
                )}
              </div>
              {editando ? (
                <EditarComunicacaoForm m={m} onSalvar={(patch) => salvarEdicao(m.id, patch)} onCancelar={() => setEditingId(null)} />
              ) : (
                <>
                  {typeof m.avaliacao === "number" && m.avaliacao > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <StarRating value={m.avaliacao} onChange={() => {}} readOnly />
                      {m.motivoAvaliacao && <span className="muted" style={{ fontSize: 12 }}>— {m.motivoAvaliacao}</span>}
                    </div>
                  )}
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.text}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                    por {txt(m.who)}{m.editadoPor ? ` • editado por ${txt(m.editadoPor)}` : ""}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
