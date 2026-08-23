import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { campoEfetivo, isManualClaim } from "../../logic/claims";
import { txt, uid } from "../../logic/format";
import { caminhoPastaAnexoProcesso } from "../../logic/anexosProcesso";
import { isDriveUploadConfigured, uploadArquivoDrive, CONTEXTO_ANEXOS_PROCESSO } from "../../logic/driveUpload";
import { extractUrlApolice } from "../../logic/corpApi";
import { useDocumentoCorp } from "../../hooks/useDocumentoCorp";

// Link da apólice (PDF) direto do CORP — endpoint /documento, vinculado por
// codfil+nosnum (nosnum é a chave universal do CORP), igual ao Agente/
// Produtor da Visão geral. Processos manuais não têm nosnum real, então não
// disparam a busca.
function ApoliceCorpBox({ c, config }) {
  const { resp, carregando, erro } = useDocumentoCorp(c, config);
  if (isManualClaim(c)) return null;
  const url = extractUrlApolice(resp);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <div>
        <b style={{ fontSize: 13 }}>Apólice (CORP)</b>
        {carregando && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>Buscando...</span>}
        {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 2 }}>{erro}</div>}
        {!carregando && !erro && !url && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Nenhuma apólice encontrada para este processo.</div>}
      </div>
      {url && <a href={url} target="_blank" rel="noreferrer" className="btn sec xs">Abrir apólice (PDF)</a>}
    </div>
  );
}

function fmtDataHora(iso) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

// Anexos gerais do processo (proposta de seguro, dados do segurado, etc.) —
// a pedido do usuário, separado dos anexos da Mesa de Atendimento: pasta
// própria no Drive (CONTEXTO_ANEXOS_PROCESSO), uma subpasta por processo
// (número do sinistro + segurado). Ver docs/mesa-atendimento.md.
export function AnexosPanel({ c, overrides, config, actions, canEdit, currentUser }) {
  const anexos = (overrides[c.id] || {}).anexos || [];
  const uploadOk = isDriveUploadConfigured(config);
  const endpoint = config.corp_drive_upload_endpoint || "";
  const numsinEf = campoEfetivo(overrides, c, "numsin") || "#" + c.nosnum;
  const seguradoEf = campoEfetivo(overrides, c, "segurado");
  const pasta = caminhoPastaAnexoProcesso(numsinEf, seguradoEf);

  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleFiles(fileList) {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não anexar arquivos."); return; }
    const lista = Array.from(fileList || []);
    if (!lista.length) return;
    setEnviando(true); setErro(null);
    try {
      for (const file of lista) {
        const enviado = await uploadArquivoDrive({ endpoint, file, pasta, contexto: CONTEXTO_ANEXOS_PROCESSO });
        const registro = {
          id: uid("anx"), nome: enviado.nome, url: enviado.url,
          descricao: descricao.trim(), enviadoPor: (currentUser && currentUser.nome) || "—",
          enviadoEm: new Date().toISOString(),
        };
        actions.addAnexo(c.id, registro);
        actions.logAudit(c.id, "Anexo adicionado", registro.descricao ? `${registro.nome} — ${registro.descricao}` : registro.nome);
      }
      setDescricao("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  function remover(anexo) {
    if (!canEdit) { alert("Seu perfil é apenas de consulta. Você pode visualizar, mas não remover anexos."); return; }
    if (!confirm(`Remover o anexo "${anexo.nome}" desta lista? (o arquivo continua no Drive, só a referência some daqui)`)) return;
    actions.removeAnexo(c.id, anexo.id);
    actions.logAudit(c.id, "Anexo removido da lista", anexo.nome);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Anexos</h3>
        <span className="muted" style={{ fontSize: 12 }}>{anexos.length} arquivo(s)</span>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Proposta de seguro, dados do segurado ou qualquer outro documento do processo. Fica salvo no Google Drive (pasta própria, separada dos anexos da Mesa de Atendimento) — o link abre em uma nova guia.
      </p>

      <ApoliceCorpBox c={c} config={config} />

      {!anexos.length ? <EmptyState>Nenhum anexo ainda.</EmptyState> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {anexos.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
              <div>
                <a href={a.url} target="_blank" rel="noreferrer">{a.nome}</a>
                {a.descricao && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{a.descricao}</span>}
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{txt(a.enviadoPor)} • {fmtDataHora(a.enviadoEm)}</div>
              </div>
              {canEdit && <a style={{ color: "var(--danger)", cursor: "pointer", fontSize: 12 }} onClick={() => remover(a)}>✕ Remover</a>}
            </div>
          ))}
        </div>
      )}

      {!uploadOk ? (
        <p className="muted" style={{ fontSize: 12 }}>Configure o upload de anexos em Configurações para habilitar o envio.</p>
      ) : canEdit ? (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div className="field">
            <label>Descrição (opcional)</label>
            <input placeholder="Ex.: Proposta de seguro assinada" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <input type="file" multiple disabled={enviando} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          {enviando && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Enviando...</div>}
          {erro && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erro}</div>}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 12 }}>Seu perfil é apenas de consulta — você pode visualizar os anexos, mas não adicionar novos.</p>
      )}
    </div>
  );
}
