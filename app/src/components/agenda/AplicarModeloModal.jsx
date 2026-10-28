import { useState } from "react";
import { createPortal } from "react-dom";
import { RECORRENCIAS, DIAS_SEMANA, fmtDataBRCurta } from "../../logic/agenda";

// Aplica um modelo de dia na agenda de um ou mais usuários (o gestor pode
// aplicar pra equipe toda de uma vez; o Atendente/Analista só na própria).
export function AplicarModeloModal({ modelos, presets, agendaUsers, userIdInicial, podeEscolherUsuarios, dataInicial, onAplicar, onClose }) {
  const [modeloId, setModeloId] = useState(modelos[0] ? modelos[0].id : "");
  const [userIds, setUserIds] = useState([userIdInicial].filter(Boolean));
  const [dataInicio, setDataInicio] = useState(dataInicial);
  const [recTipo, setRecTipo] = useState("dias_uteis");
  const [dias, setDias] = useState([1, 2, 3, 4, 5]);
  const [substituir, setSubstituir] = useState(true);

  const modelo = modelos.find((m) => m.id === modeloId);
  const nomeItem = (it) => { const p = presets.find((x) => x.id === it.presetId); return p ? `${p.icone || ""} ${p.nome}` : "(preset removido)"; };
  const valido = modelo && modelo.itens.length && userIds.length && dataInicio && (recTipo !== "semanal" || dias.length);

  function toggle(lista, set, v) { set(lista.indexOf(v) >= 0 ? lista.filter((x) => x !== v) : [...lista, v]); }

  function aplicar() {
    if (!valido) return;
    onAplicar({
      modelo, userIds, dataInicio, substituir,
      recorrencia: recTipo === "semanal" ? { tipo: "semanal", dias } : { tipo: recTipo },
    });
  }

  return createPortal(
    <div className="agenda-modal-fundo" onClick={onClose}>
      <div className="agenda-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Aplicar modelo de dia</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Modelo</label>
          <select value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.itens.length} ações)</option>)}
          </select>
        </div>

        {podeEscolherUsuarios && (
          <div className="field">
            <label>Aplicar na agenda de</label>
            <div className="chips" style={{ marginBottom: 0 }}>
              <div className="chip-btn" onClick={() => setUserIds(userIds.length === agendaUsers.length ? [] : agendaUsers.map((u) => u.id))}>
                {userIds.length === agendaUsers.length ? "Desmarcar todos" : "Toda a equipe"}
              </div>
              {agendaUsers.map((u) => (
                <div key={u.id} className={"chip-btn" + (userIds.indexOf(u.id) >= 0 ? " active" : "")} onClick={() => toggle(userIds, setUserIds, u.id)}>{u.nome}</div>
              ))}
            </div>
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>A partir de</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="field">
            <label>Repetição</label>
            <select value={recTipo} onChange={(e) => setRecTipo(e.target.value)}>
              {RECORRENCIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        {recTipo === "semanal" && (
          <div className="chips">
            {DIAS_SEMANA.map(([d, l]) => (
              <div key={d} className={"chip-btn" + (dias.indexOf(d) >= 0 ? " active" : "")} onClick={() => toggle(dias, setDias, d)}>{l}</div>
            ))}
          </div>
        )}

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 500 }}>
          <input type="checkbox" style={{ width: "auto", marginTop: 2 }} checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
          <span>
            Substituir a agenda atual a partir de {dataInicio ? fmtDataBRCurta(dataInicio) : "—"}
            <span className="muted" style={{ display: "block", fontWeight: 400, fontSize: 11.5 }}>
              As ações que se repetem são encerradas na véspera e as avulsas a partir dessa data são removidas. Desmarcado, o modelo é somado ao que já existe.
            </span>
          </span>
        </label>

        {modelo && (
          <div className="agenda-modal-secao" style={{ maxHeight: 180, overflow: "auto", fontSize: 12 }}>
            {modelo.itens.map((it, i) => <div key={i} className="mono">{it.inicio}{it.fim && it.fim !== it.inicio ? "–" + it.fim : ""} • {nomeItem(it)}</div>)}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn sm" disabled={!valido} onClick={aplicar}>Aplicar modelo</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
