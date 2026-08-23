import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { useAuth } from "../../hooks/useAuth";
import { loadComms, currentStage, allJourneyStages } from "../../logic/claims";
import { fmtDateBR, todayISO, txt } from "../../logic/format";
import { generateContent, isGeminiConfigured } from "../../ai/geminiApi.js";
import { takeComsPrefill } from "../../state/comsPrefill";

const MEIOS = ["Telefone", "WhatsApp", "E-mail", "Presencial", "Outro"];
const TITULO_AVULSO = "__avulso__";
const CANAL_LABEL = { Cliente: "o Cliente", Oficina: "a Oficina", Seguradora: "a Seguradora" };
const CANAL_BADGE = { Cliente: "green", Oficina: "amber", Seguradora: "purple" };

function blankBox() {
  return { texto: "", meio: MEIOS[0], aguardandoRetorno: false, avaliacao: 0, motivoAvaliacao: "" };
}

function Star({ filled, onClick, readOnly }) {
  return (
    <svg
      onClick={readOnly ? undefined : onClick} viewBox="0 0 24 24" width={16} height={16}
      fill={filled ? "var(--warn)" : "none"} stroke="var(--warn)" strokeWidth="1.5"
      style={{ cursor: readOnly ? "default" : "pointer" }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
// Avaliação de 5 estrelas — a pedido do usuário, guardada em Oficina/
// Seguradora pra futuramente ranquear desempenho (só o campo, por enquanto;
// nenhum ranking foi construído ainda).
function StarRating({ value, onChange, readOnly }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= value} onClick={() => onChange(value === n ? 0 : n)} readOnly={readOnly} />
      ))}
    </div>
  );
}

function ComunicacaoBox({ canal, box, onChange, comAvaliacao }) {
  function set(patch) { onChange({ ...box, ...patch }); }
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>Comunicação com {CANAL_LABEL[canal]}</b>
        <select value={box.meio} onChange={(e) => set({ meio: e.target.value })} style={{ width: "auto" }}>
          {MEIOS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <textarea rows={3} placeholder="Descreva a comunicação realizada..." value={box.texto} onChange={(e) => set({ texto: e.target.value })} />
      {comAvaliacao && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <StarRating value={box.avaliacao} onChange={(v) => set({ avaliacao: v })} />
          <input placeholder="Motivo da avaliação (opcional)" value={box.motivoAvaliacao} onChange={(e) => set({ motivoAvaliacao: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
        </div>
      )}
      <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, fontSize: 12.5, cursor: "pointer" }}>
        <input type="checkbox" checked={box.aguardandoRetorno} onChange={() => set({ aguardandoRetorno: !box.aguardandoRetorno })} />
        Aguardando retorno
      </label>
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

// Porte 1:1 de commsPanel() do HTML original (histórico de comunicações),
// evoluído a pedido do usuário: três caixas fixas (Cliente/Oficina/
// Seguradora, cada uma com seu próprio Meio), avaliação em estrelas +
// motivo em Oficina/Seguradora (base pra um ranking futuro de desempenho,
// ainda não construído), "Aguardando retorno" nas três (pra filtrar depois)
// e uma quarta caixa com sugestão de mensagem pro cliente via IA. Título e
// Data ficam compartilhados; um único "Registrar" cria uma entrada no
// histórico pra cada caixa preenchida naquele momento.
export function CommsPanel({ c, overrides, actions, canEdit, config }) {
  const { currentUser } = useAuth();
  const list = loadComms(overrides, c.id).slice().reverse();
  const templates = (config && config.corp_journey_templates) || {};
  const atendTemplateCfg = config && config.corp_atendimento_template;
  const etapaAtual = currentStage(overrides, templates, atendTemplateCfg, c) || "";
  const titulosEtapas = allJourneyStages(templates, atendTemplateCfg);

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

  const tituloResolvido = titulo === TITULO_AVULSO ? tituloAvulso.trim() : titulo;

  function registrar() {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não editar processos."); return; }
    if (!tituloResolvido) { alert("Selecione ou informe um título para o registro."); return; }
    const candidatos = [
      { canal: "Cliente", box: boxCliente, comAvaliacao: false },
      { canal: "Oficina", box: boxOficina, comAvaliacao: true },
      { canal: "Seguradora", box: boxSeguradora, comAvaliacao: true },
    ];
    const novos = candidatos.filter(({ box }) => box.texto.trim()).map(({ canal, box, comAvaliacao }) => ({
      id: "cm_" + Math.random().toString(36).slice(2, 9), titulo: tituloResolvido, canal, meio: box.meio, date: data,
      text: box.texto.trim(), aguardandoRetorno: !!box.aguardandoRetorno,
      ...(comAvaliacao ? { avaliacao: box.avaliacao || 0, motivoAvaliacao: (box.motivoAvaliacao || "").trim() } : {}),
      who: (currentUser && currentUser.nome) || "—", at: new Date().toISOString(),
    }));
    if (!novos.length) { alert("Preencha ao menos uma das comunicações (Cliente, Oficina ou Seguradora)."); return; }
    const arr = [...loadComms(overrides, c.id), ...novos];
    actions.saveComms(c.id, arr);
    actions.logAudit(c.id, "Comunicação registrada", `${tituloResolvido} — ${novos.map((n) => n.canal).join(", ")}`);
    setBoxCliente(blankBox()); setBoxOficina(blankBox()); setBoxSeguradora(blankBox());
    setTitulo(etapaAtual); setTituloAvulso("");
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

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Registrar comunicação</h3>
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
          <ComunicacaoBox canal="Cliente" box={boxCliente} onChange={setBoxCliente} comAvaliacao={false} />
          <ComunicacaoBox canal="Oficina" box={boxOficina} onChange={setBoxOficina} comAvaliacao />
          <ComunicacaoBox canal="Seguradora" box={boxSeguradora} onChange={setBoxSeguradora} comAvaliacao />
          <SugestaoClienteBox titulo={tituloResolvido} oficinaTexto={boxOficina.texto} seguradoraTexto={boxSeguradora.texto} />
        </div>

        <button className="btn" style={{ marginTop: 14 }} onClick={registrar}>Registrar comunicação</button>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Histórico de comunicações</h3>
          <span className="tag-manual">Registro manual preservado na sincronização</span>
        </div>
        {!list.length ? <EmptyState>Nenhuma comunicação registrada.</EmptyState> : list.map((m) => {
          return (
            <div key={m.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                <div>
                  {m.titulo && <span className="badge blue" style={{ marginRight: 6 }}>{m.titulo}</span>}
                  <span className={"badge " + CANAL_BADGE[m.canal]}>{m.canal}</span>
                  {m.aguardandoRetorno && <span className="badge amber" style={{ marginLeft: 6 }}>Aguardando retorno</span>}
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{m.meio} • {fmtDateBR(m.date)}</span>
                </div>
                <button className="btn danger xs" onClick={() => excluir(m.id)}>Excluir</button>
              </div>
              {typeof m.avaliacao === "number" && m.avaliacao > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <StarRating value={m.avaliacao} onChange={() => {}} readOnly />
                  {m.motivoAvaliacao && <span className="muted" style={{ fontSize: 12 }}>— {m.motivoAvaliacao}</span>}
                </div>
              )}
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.text}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>por {txt(m.who)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
