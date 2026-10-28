import { useState } from "react";
import { EmptyState } from "../EmptyState.jsx";
import { Avatar } from "../Avatar.jsx";
import { FEEDBACK_TIPOS, dataLocalISO, addDias, fmtDataBRCurta, fmtHoraDe } from "../../logic/agenda";

const LIMITE = 300;

// Feedbacks da agenda — o gestor (Administrador/VIP) vê os de toda a
// equipe; Atendente/Analista vê só os próprios.
export function FeedbacksPanel({ feedbacks, users, agendaUsers, podeVerTodos, currentUser, userIdInicial }) {
  const hoje = dataLocalISO();
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [userId, setUserId] = useState(podeVerTodos ? (userIdInicial || "todos") : currentUser.id);
  const [tipo, setTipo] = useState("todos");

  const porId = {};
  users.forEach((u) => { porId[u.id] = u; });

  const lista = (feedbacks || [])
    .filter((f) => (podeVerTodos ? (userId === "todos" || f.userId === userId) : f.userId === currentUser.id))
    .filter((f) => (!de || f.data >= de) && (!ate || f.data <= ate))
    .filter((f) => tipo === "todos" || f.tipo === tipo)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return (
    <div className="card">
      <div className="chips" style={{ alignItems: "center" }}>
        {podeVerTodos && (
          <select className="inline" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: "auto" }}>
            <option value="todos">Toda a equipe</option>
            {agendaUsers.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
        <select className="inline" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: "auto" }}>
          <option value="todos">Todos os tipos</option>
          {Object.keys(FEEDBACK_TIPOS).map((k) => <option key={k} value={k}>{FEEDBACK_TIPOS[k].label}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>de</span>
        <input type="date" className="inline" value={de} onChange={(e) => setDe(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>até</span>
        <input type="date" className="inline" value={ate} onChange={(e) => setAte(e.target.value)} />
        <div className="chip-btn" onClick={() => { setDe(hoje); setAte(hoje); }}>Hoje</div>
        <div className="chip-btn" onClick={() => { setDe(addDias(hoje, -6)); setAte(hoje); }}>7 dias</div>
        <div className="chip-btn" onClick={() => { setDe(addDias(hoje, -29)); setAte(hoje); }}>30 dias</div>
      </div>

      {!lista.length ? <EmptyState>Nenhum feedback no filtro selecionado.</EmptyState> : (
        <div className="agenda-feedbacks">
          {lista.slice(0, LIMITE).map((f) => {
            const u = porId[f.userId];
            const autor = f.autorId && f.autorId !== f.userId ? porId[f.autorId] : null;
            const t = FEEDBACK_TIPOS[f.tipo] || { label: f.tipo, badge: "gray" };
            return (
              <div key={f.id} className="agenda-feedback">
                <Avatar url={u && u.fotoUrl} nome={u ? u.nome : "?"} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <b style={{ fontSize: 13 }}>{u ? u.nome : "Usuário removido"}</b>
                    <span className={"badge " + t.badge}>{t.label}</span>
                    {f.semInicio && <span className="badge orange">Sem início registrado</span>}
                    <span className="muted" style={{ fontSize: 12 }}>
                      {f.icone} {f.titulo} • previsto {f.previstoInicio}{f.previstoFim && f.previstoFim !== f.previstoInicio ? "–" + f.previstoFim : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{f.texto}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {fmtDataBRCurta(f.data)} • registrado às {fmtHoraDe(f.at)}{autor ? ` por ${autor.nome}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {lista.length > LIMITE && <p className="muted" style={{ fontSize: 12 }}>Mostrando os {LIMITE} mais recentes de {lista.length}. Reduza o período para ver os demais.</p>}
        </div>
      )}
    </div>
  );
}
