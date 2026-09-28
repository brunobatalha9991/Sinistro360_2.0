import { useEffect, useState } from "react";

function prefersReducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  catch { return false; }
}

// Porte 1:1 de animateKpiNumber() do HTML original — efeito "contador" nos KPIs.
function useAnimatedKpi(finalText) {
  const [display, setDisplay] = useState(finalText);
  useEffect(() => {
    if (prefersReducedMotion()) { setDisplay(finalText); return; }
    const m = String(finalText).match(/^([^\d-]*)([\d.,]*\d)([^\d]*)$/);
    if (!m) { setDisplay(finalText); return; }
    const [, prefix, numStr, suffix] = m;
    const hasComma = numStr.indexOf(",") >= 0;
    const cleanNum = numStr.replace(/\./g, "").replace(",", ".");
    const target = parseFloat(cleanNum);
    if (isNaN(target)) { setDisplay(finalText); return; }
    const decimals = hasComma ? (cleanNum.split(".")[1] || "").length : 0;
    const dur = 650;
    let start = null, raf;
    function frame(ts) {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      setDisplay(prefix + val.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix);
      if (p < 1) raf = requestAnimationFrame(frame); else setDisplay(finalText);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finalText]);
  return display;
}

// Porte de kpi() do HTML original + clique (a pedido do usuário: todo campo
// do Dashboard que representa um CONJUNTO de processos abre a tela Sinistros
// já filtrada). Sem `onClick` o KPI segue exatamente como era — os cartões
// de taxa, valor e tempo médio (que são cálculos, não um conjunto) ficam sem
// clique de propósito.
export function Kpi({ n, l, cls, sub, alert, onClick, title }) {
  const display = useAnimatedKpi(n);
  const clicavel = typeof onClick === "function";
  function keyDown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick();
  }
  return (
    <div
      className={"kpi " + (cls || "") + (alert ? " kpi-alert" : "") + (clicavel ? " clickable" : "")}
      onClick={clicavel ? onClick : undefined}
      title={clicavel ? (title || "Ver os sinistros deste indicador") : undefined}
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onKeyDown={clicavel ? keyDown : undefined}
    >
      <div className="n">{display}</div>
      <div className="l">{l}{clicavel ? <span className="kpi-go" aria-hidden="true">›</span> : null}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}
