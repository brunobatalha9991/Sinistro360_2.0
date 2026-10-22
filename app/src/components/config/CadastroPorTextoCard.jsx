import { useMemo, useState } from "react";
import { CAMPOS_CADASTRO_TEXTO, gerarPromptCadastro, parseCadastroTexto } from "../../logic/cadastroPorTexto";
import { setAberturaPrefill } from "../../state/aberturaPrefill";
import { fmtDateBR, money } from "../../logic/format";

// Cadastro de processo por texto (a pedido do usuário). Fluxo:
//   1. o operador copia o prompt gerado aqui (com os catálogos atuais do
//      sistema) e cola no Claude Chat junto com os anexos do sinistro
//      aberto na seguradora (PDF, prints, e-mails);
//   2. o Claude devolve um bloco "CHAVE: valor";
//   3. o operador cola o bloco na tela aberta por este card, confere a
//      prévia (campo reconhecido × campo em branco) e segue pro módulo
//      Abertura já pré-preenchido.
// O processo só nasce no clique de "Criar processo" dentro da Abertura —
// mesmo caminho do importador de formulário comercial (PDF), ver
// ImportarFormularioComercialCard.jsx e logic/cadastroPorTexto.js.
// `canEdit` = pode abrir processos (abre a tela); `canEditPrompt` = admin
// (salva as instruções adicionais do prompt).
export function CadastroPorTextoCard({ config, saveConfig, catalogos, navigate, canEdit, canEditPrompt }) {
  const cfg = config.corp_cadastro_texto_cfg || {};
  const [instrucoes, setInstrucoes] = useState(cfg.instrucoesExtras || "");
  const [mostrarPrompt, setMostrarPrompt] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [status, setStatus] = useState(null);
  const [telaAberta, setTelaAberta] = useState(false);

  const prompt = useMemo(() => gerarPromptCadastro(catalogos, instrucoes), [catalogos, instrucoes]);
  const instrucoesAlteradas = instrucoes !== (cfg.instrucoesExtras || "");

  function salvarInstrucoes() {
    if (!canEditPrompt) { alert("Apenas administradores podem alterar o prompt."); return; }
    saveConfig("corp_cadastro_texto_cfg", (cur) => ({ ...(cur || {}), instrucoesExtras: instrucoes.trim() }));
    setStatus({ cls: "ok", msg: "Instruções salvas — já entram no prompt copiado." });
  }

  function copiarPrompt() {
    const fim = () => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(prompt).then(fim).catch(() => setMostrarPrompt(true));
    } else {
      setMostrarPrompt(true);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Cadastro de processo por texto (IA)</h3>
      <p className="muted">
        Abra o Claude Chat, anexe o PDF e/ou prints do sinistro aberto na seguradora e cole o prompt abaixo. O Claude devolve um bloco de texto no formato que o sistema reconhece; cole esse bloco em "Abrir cadastro por texto" e o módulo Abertura abre pré-preenchido. Campo não identificado fica em branco para preenchimento manual. O processo só é criado no clique de "Criar processo".
      </p>
      <p className="muted" style={{ fontSize: 12 }}>
        O prompt já inclui as seguradoras, ramos, oficinas, agentes, produtores e responsáveis cadastrados hoje, para o Claude devolver o nome exato. Copie de novo sempre que esses catálogos mudarem.
      </p>

      <div className="field">
        <label>Instruções adicionais ao prompt (opcional)</label>
        <textarea
          rows={3} value={instrucoes} disabled={!canEditPrompt}
          placeholder="Ex.: Quando o documento for da Porto Seguro, o número do sinistro é o campo 'Nº Aviso'. Oficinas da rede referenciada devem ir em OBSERVACOES, não em OFICINA."
          onChange={(e) => { setInstrucoes(e.target.value); setStatus(null); }}
        />
        {!canEditPrompt && <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Só administradores alteram as instruções do prompt.</p>}
        {instrucoesAlteradas && canEditPrompt && (
          <button type="button" className="btn sec sm" style={{ marginTop: 6 }} onClick={salvarInstrucoes}>Salvar instruções</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn sec" onClick={copiarPrompt}>{copiado ? "✔ Prompt copiado!" : "📋 Copiar prompt para o Claude"}</button>
        <button type="button" className="btn ghost" onClick={() => setMostrarPrompt((v) => !v)}>{mostrarPrompt ? "Ocultar prompt" : "Ver prompt"}</button>
        <button type="button" className="btn" disabled={!canEdit} onClick={() => setTelaAberta(true)}>➜ Abrir cadastro por texto</button>
      </div>
      {!canEdit && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Seu perfil é apenas de consulta — o cadastro por texto só está disponível para quem pode abrir processos.</p>}
      {mostrarPrompt && (
        <div className="field" style={{ marginTop: 12 }}>
          <label>Prompt (selecione tudo e copie, caso o botão não funcione no seu navegador)</label>
          <textarea readOnly rows={16} value={prompt} style={{ fontFamily: "monospace", fontSize: 12 }} onFocus={(e) => e.target.select()} />
        </div>
      )}
      {status && <div className={"status " + status.cls}>{status.msg}</div>}

      {telaAberta && (
        <CadastroPorTextoModal catalogos={catalogos} navigate={navigate} onClose={() => setTelaAberta(false)} />
      )}
    </div>
  );
}

function matchCatalogo(lista, valor) {
  if (!valor) return null;
  const alvo = String(valor).trim().toLowerCase();
  return (lista || []).find((o) => String(o || "").trim().toLowerCase() === alvo) || null;
}

// Como o valor vai aparecer no módulo Abertura — mesma regra de
// computeImportInit em pages/Abertura.jsx: Seguradora/Ramo/Oficina/Agente
// sem correspondência caem em "+ Novo..."; Produtor/Responsável sem
// correspondência ficam em branco pra escolha manual.
function situacaoCatalogo(campo, valor, catalogos) {
  if (!campo.catalogo || !valor) return null;
  const lista = (catalogos || {})[campo.catalogo] || [];
  const achou = matchCatalogo(lista, valor);
  if (achou) return { cls: "green", txt: "no catálogo" };
  if (campo.catalogo === "produtores" || campo.catalogo === "responsaveis") return { cls: "red", txt: "não encontrado — selecionar manualmente" };
  return { cls: "amber", txt: "novo — será criado" };
}

function formatarValor(campo, valor) {
  if (!valor) return "";
  if (campo.tipo === "date") return fmtDateBR(valor);
  if (campo.tipo === "money") return money(valor);
  return valor;
}

function CadastroPorTextoModal({ catalogos, navigate, onClose }) {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState(null);

  function interpretar() {
    setResultado(parseCadastroTexto(texto));
  }

  function abrirAbertura() {
    if (!resultado || !resultado.ok) return;
    setAberturaPrefill({ tipoParte: resultado.data.tipoParte, segurado: resultado.data.segurado, importado: resultado.data });
    onClose();
    navigate("abertura");
  }

  // TELEFONE/EMAIL viram clienteContatos no parse — pra prévia, mostra de
  // volta nos campos originais.
  function valorDoCampo(campo) {
    const d = resultado.data;
    if (campo.key === "clienteTelefone") return (d.clienteContatos[0] || {}).telefone || "";
    if (campo.key === "clienteEmail") return (d.clienteContatos[0] || {}).email || "";
    return d[campo.key] || "";
  }

  const ok = resultado && resultado.ok;
  const preenchidos = ok ? CAMPOS_CADASTRO_TEXTO.filter((c) => valorDoCampo(c)) : [];
  const emBranco = ok ? CAMPOS_CADASTRO_TEXTO.filter((c) => !valorDoCampo(c)) : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div className="card" style={{ width: "min(960px, 100%)", margin: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Cadastro de processo por texto</h3>
          <button type="button" className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Cole abaixo a resposta do Claude (o bloco entre os marcadores, ou a resposta inteira). Clique em "Interpretar" para conferir o que foi reconhecido antes de seguir para o formulário.
        </p>

        <div className="field">
          <label>Texto devolvido pelo Claude</label>
          <textarea
            rows={12} value={texto} style={{ fontFamily: "monospace", fontSize: 12 }}
            placeholder={"-----SINISTRO360-CADASTRO-INICIO-----\nTIPO: Segurado\nNOME: ...\n..."}
            onChange={(e) => { setTexto(e.target.value); setResultado(null); }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn sec" disabled={!texto.trim()} onClick={interpretar}>🔎 Interpretar texto</button>
          <button type="button" className="btn ghost" disabled={!texto} onClick={() => { setTexto(""); setResultado(null); }}>Limpar</button>
        </div>

        {resultado && !resultado.ok && <div className="status err">{resultado.error}</div>}

        {ok && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <span className="badge green">{preenchidos.length} reconhecido{preenchidos.length === 1 ? "" : "s"}</span>
              <span className="badge gray">{emBranco.length} em branco</span>
              {resultado.avisos.length > 0 && <span className="badge amber">{resultado.avisos.length} aviso{resultado.avisos.length === 1 ? "" : "s"}</span>}
            </div>

            {resultado.avisos.length > 0 && (
              <div className="status err" style={{ marginTop: 0, marginBottom: 10 }}>
                {resultado.avisos.map((a, i) => <div key={i}>{a}</div>)}
              </div>
            )}

            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              {CAMPOS_CADASTRO_TEXTO.map((campo) => {
                const valor = valorDoCampo(campo);
                const sit = situacaoCatalogo(campo, valor, catalogos);
                return (
                  <div key={campo.key} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, padding: "6px 10px", borderBottom: "1px solid var(--border-soft)", fontSize: 13, alignItems: "start" }}>
                    <div className="muted" style={{ fontWeight: 600 }}>{campo.titulo}</div>
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {valor
                        ? <>{formatarValor(campo, valor)}{sit && <span className={"badge " + sit.cls} style={{ marginLeft: 8 }}>{sit.txt}</span>}</>
                        : <span className="muted" style={{ fontStyle: "italic" }}>— em branco, preencher manualmente</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {resultado.ignorados.length > 0 && (
              <details style={{ marginTop: 10, fontSize: 12 }}>
                <summary className="muted">Linhas ignoradas ({resultado.ignorados.length}) — não correspondem a nenhum campo</summary>
                <pre style={{ whiteSpace: "pre-wrap", margin: "6px 0 0", fontSize: 11.5 }}>{resultado.ignorados.join("\n")}</pre>
              </details>
            )}

            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              Ao continuar, o módulo Abertura abre com estes dados. Revise tudo, complete os campos em branco e só então clique em "Criar processo". Nada é gravado até esse clique.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={abrirAbertura}>➜ Abrir formulário pré-preenchido</button>
              <button type="button" className="btn sec" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
