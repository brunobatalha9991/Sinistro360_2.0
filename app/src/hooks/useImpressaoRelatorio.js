import { useEffect, useState } from "react";

// PDF pelo próprio navegador (window.print), igual ao Dashboard: sai
// vetorial e sem dependência nova. Enquanto `printing` é true o relatório
// renderiza só a capa + a tabela (RelatorioPrintView, em
// components/relatorios/RelatorioBase.jsx).
export function useImpressaoRelatorio() {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    let encerrado = false;
    function encerrar() { if (encerrado) return; encerrado = true; setPrinting(false); }
    window.addEventListener("afterprint", encerrar);
    const t = setTimeout(() => {
      try { window.print(); } catch { /* navegador sem suporte: volta ao normal */ }
      setTimeout(encerrar, 1200);
    }, 200);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", encerrar); };
  }, [printing]);
  return { printing, imprimir: () => setPrinting(true) };
}
