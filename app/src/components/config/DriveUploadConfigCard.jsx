import { useState } from "react";
import { isDriveUploadConfigured } from "../../logic/driveUpload";

// Configuração do endpoint de upload de anexos (Google Drive via Apps
// Script) — a pedido do usuário: uploads de "Mesa de Atendimento" (CNH,
// fotos, boletim de ocorrência etc.) vão para o Drive sem exigir login
// Google de quem envia. Passo a passo de publicação do Apps Script em
// docs/mesa-atendimento.md.
export function DriveUploadConfigCard({ config, saveConfig, canEdit }) {
  const [url, setUrl] = useState(config.corp_drive_upload_endpoint || "");
  const configurado = isDriveUploadConfigured(config);

  function salvar() {
    if (!canEdit) { alert("Apenas administradores podem alterar esta configuração."); return; }
    saveConfig("corp_drive_upload_endpoint", url.trim());
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Upload de Anexos (Google Drive)</h3>
      <p className="muted">
        URL do Google Apps Script publicado como Web App — usada tanto pelo formulário de "Solicitação de Atendimento" (Mesa de Atendimento) quanto pela aba "Anexos" de cada processo, para enviar arquivos ao Drive sem exigir login Google de quem está enviando. As duas áreas usam pastas-raiz separadas no mesmo script (não se misturam). Veja o passo a passo de publicação em <code>docs/mesa-atendimento.md</code>.
      </p>
      <p style={{ fontSize: 13 }}>
        Status: <span className={"badge " + (configurado ? "green" : "amber")}>{configurado ? "Configurado" : "Não configurado"}</span>
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="inline" style={{ minWidth: 380, flex: 1 }}
          placeholder="https://script.google.com/macros/s/XXXXXXXX/exec"
          value={url} onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn sec sm" onClick={salvar}>Salvar</button>
      </div>
    </div>
  );
}
