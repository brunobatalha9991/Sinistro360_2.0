import { useState } from "react";
import { createPortal } from "react-dom";
import { useAgendaActions } from "../hooks/useAgendaActions";
import { FEEDBACK_TIPOS } from "../logic/agenda";

// Alarmes da Agenda (ver useAgendaAlarme.js) — a pedido do usuário:
//   - iniciar/finalizar/perdida: tela cheia que bloqueia o sistema inteiro;
//     só sai marcando a ação (iniciar / feito / não realizei) ou com a
//     soneca de 3 min, e qualquer escolha exige um feedback escrito.
//   - lembrete: visual diferente (cartão âmbar no canto, sem bloquear),
//     mas também só some com um feedback.
// Cor de cada fase vem de --alarm-rgb, igual aos outros alarmes do app
// (classes .alarme-geral-*, global.css).
const FASES = {
  iniciar: { rgb: "var(--brand-rgb)", icone: "▶", titulo: "HORA DE INICIAR", sub: "Está na hora de começar esta ação da sua agenda:" },
  finalizar: { rgb: "var(--ok-rgb)", icone: "⏱", titulo: "HORA DE FINALIZAR", sub: "O horário desta ação terminou. Registre como foi:" },
  perdida: { rgb: "var(--danger-rgb)", icone: "⚠", titulo: "AÇÃO SEM REGISTRO", sub: "O horário desta ação já passou e ela não foi iniciada:" },
};

function opcoesDaFase(fase) {
  if (fase === "iniciar") return [["inicio", "▶ Iniciar agora", "btn"]];
  if (fase === "finalizar") return [["fim", "✓ Marcar como feito", "btn"]];
  return [["fim", "✓ Marcar como feito", "btn"], ["nao_realizada", "✗ Não realizei", "btn danger"]];
}

export function FeedbackForm({ tipo, minChars, onConfirmar, onVoltar, compacto }) {
  const [texto, setTexto] = useState("");
  const ok = texto.trim().length >= minChars;
  return (
    <div style={{ textAlign: "left", marginTop: compacto ? 8 : 16 }}>
      <label style={{ fontSize: compacto ? 12 : 13 }}>
        Feedback obrigatório — {(FEEDBACK_TIPOS[tipo] || {}).pergunta}
      </label>
      <textarea
        autoFocus rows={compacto ? 2 : 3} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder={`Escreva pelo menos ${minChars} caracteres...`}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: compacto ? "flex-end" : "center", flexWrap: "wrap" }}>
        {onVoltar && <button type="button" className="btn sec sm" onClick={onVoltar}>← Voltar</button>}
        <button type="button" className="btn sm" disabled={!ok} onClick={() => onConfirmar(texto)}>Registrar feedback</button>
      </div>
    </div>
  );
}

function AlarmeTelaCheia({ alarme, restantes, cfg, onRegistrar }) {
  const [escolha, setEscolha] = useState(null);
  const { oc, fase } = alarme;
  const f = FASES[fase];
  const titulo = oc.tipo === "marco" ? oc.titulo.toUpperCase() : f.titulo;

  return (
    <div className="alarme-geral-overlay agenda-alarme" style={{ "--alarm-rgb": f.rgb }} role="alertdialog" aria-modal="true">
      <div className="alarme-geral-box">
        <div className="alarme-geral-icone">{oc.icone || f.icone}</div>
        <h2 className="alarme-geral-titulo">{titulo}</h2>
        <p className="alarme-geral-sub">{f.sub}</p>
        <div className="agenda-alarme-acao" style={{ "--bloco-cor": oc.cor }}>
          <div className="agenda-alarme-acao-titulo">{oc.titulo}</div>
          <div className="agenda-alarme-acao-hora">
            {oc.tipo === "marco" ? oc.inicio : `${oc.inicio} – ${oc.fim}`}
            {oc.descricao ? <> • {oc.descricao}</> : null}
          </div>
        </div>

        {!escolha ? (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
            {opcoesDaFase(fase).map(([tipo, label, cls]) => (
              <button key={tipo} type="button" className={cls} onClick={() => setEscolha(tipo)}>{label}</button>
            ))}
            <button type="button" className="btn sec" onClick={() => setEscolha("soneca")}>💤 Soneca {cfg.sonecaMin} min</button>
          </div>
        ) : (
          <FeedbackForm
            key={escolha} tipo={escolha} minChars={cfg.feedbackMinChars}
            onVoltar={() => setEscolha(null)}
            onConfirmar={(texto) => onRegistrar(alarme, escolha, texto)}
          />
        )}
        {restantes > 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
            + {restantes} alarme(s) da agenda na fila depois deste.
          </p>
        )}
      </div>
    </div>
  );
}

function LembreteCartao({ alarme, cfg, onRegistrar }) {
  const { oc } = alarme;
  return (
    <div className="agenda-lembrete" role="alert">
      <div className="agenda-lembrete-topo">
        <span className="agenda-lembrete-icone">⏰</span>
        <div>
          <div className="agenda-lembrete-titulo">Lembrete — começa às {oc.inicio}</div>
          <div className="agenda-lembrete-sub">{oc.icone} {oc.titulo}{oc.tipo === "marco" ? "" : ` (${oc.inicio}–${oc.fim})`}</div>
        </div>
      </div>
      <FeedbackForm
        key={alarme.key} tipo="lembrete" minChars={cfg.feedbackMinChars} compacto
        onConfirmar={(texto) => onRegistrar(alarme, "lembrete", texto)}
      />
    </div>
  );
}

export function AgendaAlarmeModal({ alarmes, cfg, currentUser }) {
  const actions = useAgendaActions();
  const telaCheia = alarmes.filter((a) => a.fase !== "lembrete");
  const lembretes = alarmes.filter((a) => a.fase === "lembrete");
  if (!telaCheia.length && !lembretes.length) return null;

  function registrar(alarme, tipo, texto) {
    actions.registrarFeedback({
      oc: alarme.oc, tipo, texto, autor: currentUser,
      fase: tipo === "soneca" ? alarme.fase : undefined,
      extra: alarme.fase === "perdida" && tipo === "fim" ? { semInicio: true } : undefined,
    });
  }

  return createPortal(
    <>
      {lembretes.length > 0 && (
        <LembreteCartao alarme={lembretes[0]} cfg={cfg} onRegistrar={registrar} />
      )}
      {telaCheia.length > 0 && (
        <AlarmeTelaCheia key={telaCheia[0].key} alarme={telaCheia[0]} restantes={telaCheia.length - 1} cfg={cfg} onRegistrar={registrar} />
      )}
    </>,
    document.body,
  );
}
