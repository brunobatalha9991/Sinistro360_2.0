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

// Porte 1:1 de kpi() do HTML original.
export function Kpi({ n, l, cls, sub, alert }) {
  const display = useAnimatedKpi(n);
  return (
    <div className={"kpi " + (cls || "") + (alert ? " kpi-alert" : "")}>
      <div className="n">{display}</div>
      <div className="l">{l}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}
