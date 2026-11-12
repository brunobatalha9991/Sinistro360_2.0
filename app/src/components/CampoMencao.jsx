import { useRef, useState } from "react";
import { mencaoEmDigitacao, sugestoesMencao, inserirMencao } from "../logic/mencoes";

// Caixa de texto com marcação "@" (a pedido do usuário): digitar "@" abre a
// lista de usuários (setas + Enter/Tab escolhem, Esc fecha). Usada no chat
// da CI, no formulário de intervenção e na tela de pedido de intervenção.
// `onKeyDown` do chamador só recebe as teclas que a lista não usou (ex.:
// Enter pra enviar, quando a lista está fechada).
export function CampoMencao({ value, onChange, users, currentUser, onKeyDown, rows = 2, placeholder, autoFocus, style }) {
  const [mencao, setMencao] = useState(null);
  const [idx, setIdx] = useState(0);
  const ref = useRef(null);
  const sugestoes = mencao ? sugestoesMencao(mencao.termo, users, currentUser && currentUser.id) : [];

  function atualizar(valor, cursor) {
    const m = mencaoEmDigitacao(valor, cursor);
    setMencao(m && sugestoesMencao(m.termo, users, currentUser && currentUser.id).length ? m : null);
    setIdx(0);
  }
  function escolher(u) {
    const el = ref.current;
    const r = inserirMencao(value, el ? el.selectionStart : value.length, mencao, u);
    onChange(r.texto);
    setMencao(null);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(r.cursor, r.cursor); } });
  }
  function tecla(e) {
    if (mencao && sugestoes.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => (i + 1) % sugestoes.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => (i - 1 + sugestoes.length) % sugestoes.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); escolher(sugestoes[Math.min(idx, sugestoes.length - 1)]); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setMencao(null); return; }
    }
    if (onKeyDown) onKeyDown(e);
  }

  return (
    <div className="mencao-campo" style={style}>
      <textarea ref={ref} rows={rows} autoFocus={autoFocus} placeholder={placeholder} style={{ width: "100%" }} value={value}
        onChange={(e) => { onChange(e.target.value); atualizar(e.target.value, e.target.selectionStart); }}
        onKeyDown={tecla}
        onClick={(e) => atualizar(e.target.value, e.target.selectionStart)}
        onBlur={() => setTimeout(() => setMencao(null), 150)}
      />
      {mencao && sugestoes.length > 0 && (
        <div className="mencao-lista" role="listbox">
          {sugestoes.map((u, i) => (
            <div key={u.id} role="option" aria-selected={i === idx} className={"mencao-op" + (i === idx ? " ativo" : "")}
              onMouseDown={(e) => { e.preventDefault(); escolher(u); }}
              onMouseEnter={() => setIdx(i)}
            >@{u.nome}</div>
          ))}
        </div>
      )}
    </div>
  );
}
