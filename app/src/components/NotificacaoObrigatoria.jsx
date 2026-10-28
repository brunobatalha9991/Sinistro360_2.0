import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { temAgendaPropria } from "../logic/agenda";
import { notificacaoSuportada } from "../hooks/useAgendaAlarme";

// Notificação do Windows obrigatória pra quem tem Agenda (a pedido do
// usuário: "não quero que tenha opção de não ativar"). O navegador não
// deixa um site ativar sozinho — só a pessoa, e só a partir de um clique —
// então o sistema fica travado atrás desta tela até a permissão estar
// "granted". Bloqueada ("denied"), o navegador não pergunta de novo: a
// tela ensina a liberar no cadeado e percebe a liberação sozinha.
const CHECK_MS = 2000;

function lerPermissao() {
  return notificacaoSuportada() ? Notification.permission : "unsupported";
}

export function NotificacaoObrigatoria({ currentUser }) {
  const [perm, setPerm] = useState(lerPermissao);
  const exigir = temAgendaPropria(currentUser) && perm !== "granted" && perm !== "unsupported";

  useEffect(() => {
    if (!exigir) return undefined;
    const atualizar = () => setPerm(lerPermissao());
    const id = setInterval(atualizar, CHECK_MS);
    window.addEventListener("focus", atualizar);
    let status = null;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "notifications" }).then((s) => { status = s; s.onchange = atualizar; }).catch(() => {});
    }
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", atualizar);
      if (status) status.onchange = null;
    };
  }, [exigir]);

  useEffect(() => {
    if (perm !== "granted" || !temAgendaPropria(currentUser)) return;
    try {
      if (sessionStorage.getItem("s360_notif_teste") === "1") return;
      sessionStorage.setItem("s360_notif_teste", "1");
    } catch { /* ignore */ }
    try {
      new Notification("✅ Notificações ativadas", { body: "Os alarmes da sua Agenda vão aparecer aqui, mesmo com o Sinistro360 minimizado." });
    } catch { /* ignore */ }
  }, [perm, currentUser]);

  if (!exigir) return null;

  function pedir() {
    Notification.requestPermission().then((p) => setPerm(p)).catch(() => setPerm(lerPermissao()));
  }

  return createPortal(
    <div className="notif-obrig-fundo" role="alertdialog" aria-modal="true">
      <div className="notif-obrig-box">
        <div style={{ fontSize: 52, lineHeight: 1 }}>🔔</div>
        <h2 style={{ margin: "10px 0 6px" }}>Ative as notificações para continuar</h2>
        <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
          Os alarmes da sua Agenda precisam aparecer mesmo quando você estiver em outro programa ou com o Sinistro360 minimizado.
          O uso do sistema é liberado assim que as notificações estiverem ativas.
        </p>

        {perm === "default" ? (
          <>
            <button type="button" className="btn" style={{ padding: "12px 22px", fontSize: 15 }} onClick={pedir}>Ativar notificações</button>
            <p className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
              O navegador vai perguntar — clique em <b>Permitir</b>. Se a pergunta não aparecer, procure um ícone de sino riscado no canto direito da barra de endereço.
            </p>
          </>
        ) : (
          <div className="notif-obrig-passos">
            <b style={{ color: "var(--danger)" }}>As notificações estão bloqueadas neste navegador.</b>
            <ol>
              <li>Clique no <b>cadeado</b> (ou no ícone de ajustes) à esquerda do endereço do site, lá em cima.</li>
              <li>Em <b>Notificações</b>, troque para <b>Permitir</b>.</li>
              <li>Pronto — esta tela some sozinha em alguns segundos. Se não sumir, aperte <b>F5</b>.</li>
            </ol>
            <button type="button" className="btn sec sm" onClick={() => location.reload()}>Já liberei — recarregar</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
