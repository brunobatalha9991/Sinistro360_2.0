import { useEffect, useState } from "react";

// Aba aberta com uma versão antiga do sistema continua rodando as regras
// antigas dos alertas automáticos (cada navegador aberto roda a automação) e
// pode desfazer o que a versão nova corrigiu. Aqui a aba confere de tempos em
// tempos se o site publicado mudou: avisa na tela e, se a aba estiver em
// segundo plano, recarrega sozinha.
const ARQUIVO = /assets\/index-[\w-]+\.js/;
const A_CADA_MS = 5 * 60 * 1000;

function arquivoCarregado() {
  const s = document.querySelector('script[type="module"][src*="assets/index-"]');
  const m = s && ARQUIVO.exec(s.getAttribute("src") || "");
  return m ? m[0] : null;
}

export function AtualizacaoDisponivel() {
  const [nova, setNova] = useState(false);

  useEffect(() => {
    const meu = arquivoCarregado();
    if (!meu) return undefined; // modo desenvolvimento
    let vivo = true;
    async function conferir() {
      try {
        const url = location.href.split("#")[0].replace(/[^/]*$/, "") + "index.html?_=" + Date.now();
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const m = ARQUIVO.exec(await r.text());
        if (!vivo || !m || m[0] === meu) return;
        setNova(true);
        if (document.hidden) location.reload();
      } catch { /* sem rede: tenta de novo depois */ }
    }
    const timer = setInterval(conferir, A_CADA_MS);
    const aoMudarVisibilidade = () => { if (document.hidden) conferir(); };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    conferir();
    return () => { vivo = false; clearInterval(timer); document.removeEventListener("visibilitychange", aoMudarVisibilidade); };
  }, []);

  if (!nova) return null;
  return (
    <div role="alert" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100000, background: "#7c3aed", color: "#fff", padding: "8px 16px", display: "flex", gap: 12, alignItems: "center", justifyContent: "center", fontSize: 14 }}>
      <span>Há uma versão nova do sistema. Atualize para receber as correções.</span>
      <button type="button" className="btn sm" onClick={() => location.reload()}>Atualizar agora</button>
    </div>
  );
}
