import { createPortal } from "react-dom";

// Caixa de diálogo do botão "Imprimir / PDF" do Dashboard (a pedido do
// usuário): antes de gerar o PDF, escolhe-se o que entra nele. TODAS as
// opções já vêm marcadas — o Dashboard recria o estado marcado a cada
// abertura (ver abrirImpressao em pages/Dashboard.jsx), então desmarcar algo
// numa geração não "contamina" a próxima.
//
// A impressão em si é a do próprio navegador (window.print), de propósito:
// os gráficos são SVG e as tabelas são HTML, então o PDF sai VETORIAL, na
// resolução da impressora — qualidade muito maior do que "fotografar" a tela
// com html2canvas/jsPDF, que rasteriza tudo em ~96 dpi e ainda pesaria mais
// megabytes no bundle. O estilo de impressão está em styles/global.css
// (@media print): fundo branco, sem menu/barra de filtros/botões, cada
// cartão inteiro numa página só.
export function DashboardPrintModal({ blocos, opts, onToggle, onMarcarTodos, onConfirm, onClose }) {
  const marcados = blocos.filter(([k]) => opts[k]).length;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 30, overflow: "auto" }}
      onClick={onClose}
    >
      <div
        style={{ width: 560, maxWidth: "100%", background: "var(--card-solid)", border: "1px solid var(--border)", borderRadius: 16, padding: 22, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>🖨 Imprimir Dashboard em PDF</h3>
          <button className="btn sec xs" onClick={onClose}>✕ Fechar</button>
        </div>

        <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
          Marque o que deve aparecer no PDF. O recorte de filtros atual do Dashboard é mantido —
          o PDF sai exatamente com os números que estão na tela.
        </p>

        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 8, maxHeight: "45vh", overflow: "auto" }}>
          {blocos.map(([k, label, hint]) => (
            <label key={k} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "6px 5px", cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={!!opts[k]} onChange={() => onToggle(k)} style={{ marginTop: 2 }} />
              <span>
                {label}
                {hint ? <span className="muted" style={{ display: "block", fontSize: 11 }}>{hint}</span> : null}
              </span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <button className="btn sec sm" onClick={() => onMarcarTodos(true)}>Marcar todos</button>
          <button className="btn sec sm" onClick={() => onMarcarTodos(false)}>Desmarcar todos</button>
          <span className="muted" style={{ fontSize: 12 }}>{marcados} de {blocos.length} seção(ões) selecionada(s)</span>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", marginTop: 14, paddingTop: 12 }}>
          <p className="muted" style={{ fontSize: 11.5, margin: "0 0 10px", lineHeight: 1.6 }}>
            Na janela de impressão do navegador, escolha <b>Destino: Salvar como PDF</b> e deixe
            <b> Gráficos de segundo plano</b> (Background graphics) marcado — é o que preserva as cores
            dos indicadores. O padrão sai em <b>A4 paisagem</b>; se preferir retrato, basta trocar ali.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button className="btn sec" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={!marcados} onClick={onConfirm}>🖨 Gerar PDF</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
