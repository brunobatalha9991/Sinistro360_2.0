import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { currentStage } from "../../logic/claims";
import { buildTemplateVars, renderTemplate, clienteWhatsappDigits, MSG_ETAPA_GENERICA } from "../../logic/msgTemplates";
import { EmptyState } from "../EmptyState.jsx";

// Botão "Mensagem para o cliente" do Histórico (CommsPanel.jsx) — sobrepõe
// a tela com os templates cadastrados em Configurações, já sugerindo o
// vinculado à etapa atual da jornada. Nada é enviado automático: o
// atendente revisa o texto (variáveis já resolvidas), copia ou abre no
// WhatsApp (se o cliente tiver telefone cadastrado no módulo Clientes).
export function MensagemTemplateModal({ c, overrides, config, clientes, actions, onClose }) {
  const templates = (config && config.corp_msg_templates) || [];
  const stageTitle = currentStage(overrides, config.corp_journey_templates || {}, config.corp_atendimento_template, c);
  const vars = useMemo(() => buildTemplateVars(c, overrides, stageTitle), [c, overrides, stageTitle]);

  const sugerido = templates.find((t) => t.etapaVinculada === stageTitle) || templates[0] || null;
  const [templateId, setTemplateId] = useState(sugerido ? sugerido.id : "");
  const selecionado = templates.find((t) => t.id === templateId) || null;
  const [texto, setTexto] = useState(() => renderTemplate(selecionado ? selecionado.texto : "", vars));
  const [copiado, setCopiado] = useState(false);

  function selecionar(id) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    setTexto(renderTemplate(t ? t.texto : "", vars));
    setCopiado(false);
  }

  const telefoneDigits = clienteWhatsappDigits(clientes, vars.cliente);

  function registrarUso(acao) {
    if (actions && selecionado) actions.logAudit(c.id, "Mensagem de template " + acao, selecionado.nome);
  }
  function copiar() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
      registrarUso("copiada");
    }).catch(() => {});
  }
  function abrirWhatsapp() {
    registrarUso("enviada via WhatsApp");
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}>
      <div style={{ width: 560, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Mensagem para o cliente</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {stageTitle ? <>Etapa atual: <b>{stageTitle}</b>. </> : null}
          Nada é enviado automático — revise o texto antes de copiar ou abrir no WhatsApp.
        </p>

        {!templates.length ? (
          <EmptyState>Nenhum template cadastrado ainda. Peça a um administrador para criar em Configurações → Mensagens ao Cliente.</EmptyState>
        ) : (
          <>
            <div className="field">
              <label>Template</label>
              <select value={templateId} onChange={(e) => selecionar(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}{t.etapaVinculada === stageTitle && stageTitle ? " (sugerido pela etapa atual)" : ""}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginTop: 8 }}>
              <label>Texto (revise antes de enviar)</label>
              <textarea rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn sec sm" onClick={copiar}>{copiado ? "Copiado!" : "Copiar texto"}</button>
              {telefoneDigits ? (
                <a
                  className="btn sm" href={`https://wa.me/${telefoneDigits}?text=${encodeURIComponent(texto)}`}
                  target="_blank" rel="noreferrer" onClick={abrirWhatsapp}
                >
                  Abrir no WhatsApp
                </a>
              ) : (
                <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                  Cadastre o telefone do cliente no módulo Clientes para abrir direto no WhatsApp.
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
