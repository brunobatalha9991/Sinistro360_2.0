import { useEffect, useState } from "react";
import { uid } from "../../logic/format";
import { getGmailToken } from "../../gmail/googleAuthClient";
import { listLabels, createLabel } from "../../logic/gmailApi";

const CAMPO_LABEL = { remetente: "Remetente", assunto: "Assunto", corpo: "Conteúdo" };

// Pastas (rótulos do Gmail) e regras de organização automática — a pedido
// do usuário. As regras ficam salvas aqui; quem AVALIA e APLICA de verdade
// é Emails.jsx, toda vez que a caixa de entrada é atualizada (usa o mesmo
// token de sessão do Gmail já conectado — precisa ter conectado ao menos
// uma vez em Configurações → E-mails ou no módulo E-mails).
export function EmailRegrasCard({ config, saveConfig, canEdit }) {
  const regras = config.corp_email_regras || [];
  const [labels, setLabels] = useState([]);
  const [erro, setErro] = useState(null);
  const [novoLabel, setNovoLabel] = useState("");
  const [campo, setCampo] = useState("remetente");
  const [valor, setValor] = useState("");
  const [labelSel, setLabelSel] = useState("");

  useEffect(() => {
    const token = getGmailToken();
    if (!token) return;
    listLabels(token).then(setLabels).catch((e) => setErro(e.message));
  }, []);

  async function criarPasta() {
    if (!canEdit) return;
    const token = getGmailToken();
    if (!token) { alert("Conecte o Gmail primeiro (aqui embaixo ou no módulo E-mails)."); return; }
    if (!novoLabel.trim()) return;
    try {
      const label = await createLabel(token, novoLabel.trim());
      setLabels((l) => [...l, label]);
      setNovoLabel("");
    } catch (e) {
      setErro(e.message);
    }
  }
  function adicionarRegra() {
    if (!canEdit) return;
    if (!valor.trim() || !labelSel) { alert("Preencha o texto da condição e escolha a pasta de destino."); return; }
    const label = labels.find((l) => l.id === labelSel);
    saveConfig("corp_email_regras", (cur) => [...(cur || []), { id: uid("regra"), campo, valor: valor.trim(), labelId: labelSel, labelNome: label ? label.name : labelSel }]);
    setValor("");
  }
  function removerRegra(id) {
    if (!canEdit) return;
    saveConfig("corp_email_regras", (cur) => (cur || []).filter((r) => r.id !== id));
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Pastas e Regras de E-mail</h3>
      <p className="muted">
        "Pastas" são rótulos do Gmail. Ao clicar em "Atualizar caixa de entrada" (módulo E-mails), cada e-mail novo é comparado com as regras abaixo — a primeira que bater move o e-mail direto pra pasta (some da caixa de entrada dentro do Gmail também, não só aqui).
      </p>
      {!getGmailToken() && <p className="muted" style={{ fontSize: 12 }}>Conecte o Gmail (abaixo, em "E-mails (Gmail)", ou no módulo E-mails) pra listar/criar pastas aqui.</p>}
      {erro && <div style={{ color: "var(--danger)", fontSize: 12 }}>{erro}</div>}

      {canEdit && (
        <>
          <div className="field"><label>Criar nova pasta</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Nome da pasta..." value={novoLabel} onChange={(e) => setNovoLabel(e.target.value)} />
              <button className="btn sec sm" onClick={criarPasta}>+ Pasta</button>
            </div>
          </div>

          <div className="grid c3" style={{ marginTop: 10 }}>
            <div className="field"><label>Se</label>
              <select value={campo} onChange={(e) => setCampo(e.target.value)}>
                <option value="remetente">Remetente</option>
                <option value="assunto">Assunto</option>
                <option value="corpo">Conteúdo</option>
              </select>
            </div>
            <div className="field"><label>contém</label>
              <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="texto..." />
            </div>
            <div className="field"><label>Mover para</label>
              <select value={labelSel} onChange={(e) => setLabelSel(e.target.value)}>
                <option value="">Selecione a pasta...</option>
                {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn sec sm" style={{ marginTop: 8 }} onClick={adicionarRegra}>+ Regra</button>
        </>
      )}

      <div style={{ marginTop: 12 }}>
        {!regras.length ? <p className="muted" style={{ fontSize: 12 }}>Nenhuma regra cadastrada.</p> : regras.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-soft)", fontSize: 13 }}>
            <span>Se <b>{CAMPO_LABEL[r.campo] || r.campo}</b> contém "<b>{r.valor}</b>" → <b>{r.labelNome}</b></span>
            {canEdit && <a style={{ color: "var(--danger)", cursor: "pointer", fontSize: 12 }} onClick={() => removerRegra(r.id)}>✕ remover</a>}
          </div>
        ))}
      </div>
    </div>
  );
}
