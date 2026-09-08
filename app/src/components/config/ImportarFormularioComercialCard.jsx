import { useRef, useState } from "react";
import { parseImportPayloadFromPdf } from "../../logic/importFormularioComercial";
import { setAberturaPrefill } from "../../state/aberturaPrefill";

// Importa o PDF gerado pelo Formulário de Abertura Comercial (formulário
// HTML solto, preenchido fora do sistema pelo time comercial — ver
// docs/Formulario-Abertura-Comercial.html) — a pedido do usuário: em vez de
// criar o processo direto, os dados lidos do PDF vão como prefill pro
// módulo Abertura (mesmo mecanismo do atalho "+ Abrir processo vinculado",
// ver state/aberturaPrefill.js e pages/Abertura.jsx), pra sempre passar por
// revisão humana antes de virar processo — em especial Agente, Produtor e
// Responsável, que no formulário externo são só sugestão em texto livre.
export function ImportarFormularioComercialCard({ navigate, canEdit }) {
  const fileRef = useRef(null);
  const [carregando, setCarregando] = useState(false);
  const [status, setStatus] = useState(null);

  async function importarArquivo(file) {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não abrir processos."); return; }
    setCarregando(true);
    setStatus(null);
    try {
      const result = await parseImportPayloadFromPdf(file);
      if (!result.ok) { setStatus({ cls: "err", msg: result.error }); return; }
      setAberturaPrefill({ tipoParte: result.data.tipoParte, segurado: result.data.segurado, importado: result.data });
      setStatus({ cls: "ok", msg: "Dados importados! Abrindo o módulo Abertura para revisão..." });
      setTimeout(() => navigate("abertura"), 400);
    } catch (err) {
      setStatus({ cls: "err", msg: "Não foi possível ler o PDF: " + ((err && err.message) || "erro desconhecido") });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Importar formulário comercial (PDF)</h3>
      <p className="muted">
        Importa o PDF exportado pelo Formulário de Abertura Comercial (docs/Formulario-Abertura-Comercial.html), preenchido fora do sistema. Os dados são lidos automaticamente do próprio PDF e o módulo Abertura abre pré-preenchido para revisão — confira principalmente Seguradora, Ramo, Agente, Produtor e Responsável antes de criar o processo.
      </p>
      <button className="btn" disabled={carregando} onClick={() => fileRef.current && fileRef.current.click()}>
        {carregando ? "Lendo PDF..." : "⬆ Importar PDF preenchido"}
      </button>
      <input
        ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) importarArquivo(f); e.target.value = ""; }}
      />
      {status && <div className={"status " + status.cls} style={{ marginTop: 10 }}>{status.msg}</div>}
    </div>
  );
}
