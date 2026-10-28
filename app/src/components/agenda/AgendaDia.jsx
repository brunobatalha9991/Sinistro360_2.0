import { useEffect, useRef, useState } from "react";
import { hhmmToMin, minToHHMM, statusOcorrencia, STATUS_LABEL } from "../../logic/agenda";

// Linha do tempo do dia (08:30–18:00 por padrão, estica se houver ação
// fora do expediente). Arrastar o bloco move a ação; puxar a borda de
// baixo muda a duração; clicar num espaço vazio cria uma ação ali.
const PX_MIN = 1.7;
const MARCO_VISUAL_MIN = 16;
const STATUS_BADGE = { pendente: "gray", atrasada: "orange", em_andamento: "blue", concluida: "green", nao_realizada: "red", perdida: "red" };

// Distribui ações sobrepostas lado a lado: cada grupo de ações que se
// encostam ganha o número de colunas que precisa.
function calcularColunas(ocs) {
  const itens = ocs.map((oc) => {
    const ini = hhmmToMin(oc.inicio);
    const fim = oc.tipo === "marco" ? ini + MARCO_VISUAL_MIN : Math.max(hhmmToMin(oc.fim), ini + 10);
    return { oc, ini, fim, col: 0, cols: 1 };
  });
  let grupo = [];
  let grupoFim = -1;
  const fecharGrupo = () => {
    const n = grupo.reduce((m, it) => Math.max(m, it.col + 1), 1);
    grupo.forEach((it) => { it.cols = n; });
    grupo = [];
  };
  itens.forEach((it) => {
    if (it.ini >= grupoFim && grupo.length) fecharGrupo();
    const usadas = grupo.filter((g) => g.fim > it.ini).map((g) => g.col);
    let c = 0;
    while (usadas.indexOf(c) >= 0) c++;
    it.col = c;
    grupo.push(it);
    grupoFim = Math.max(grupoFim, it.fim);
  });
  if (grupo.length) fecharGrupo();
  return itens;
}

export function AgendaDia({ ocorrencias, idx, agora, cfg, ehHoje, podeEditar, onCriar, onAbrir, onMover }) {
  const [arraste, setArraste] = useState(null); // {key, modo, y0, ini, fim, dIni, dFim, moveu}
  const arrasteRef = useRef(null);
  arrasteRef.current = arraste;

  let inicioMin = hhmmToMin(cfg.inicio);
  let fimMin = hhmmToMin(cfg.fim) + 30;
  ocorrencias.forEach((oc) => {
    inicioMin = Math.min(inicioMin, hhmmToMin(oc.inicio));
    fimMin = Math.max(fimMin, hhmmToMin(oc.fim) + 30);
  });
  inicioMin = Math.floor(inicioMin / 30) * 30;
  fimMin = Math.min(24 * 60, Math.ceil(fimMin / 30) * 30);
  const altura = (fimMin - inicioMin) * PX_MIN;
  const passo = Math.max(1, Number(cfg.passoMin) || 5);

  useEffect(() => {
    if (!arraste) return undefined;
    function onMove(e) {
      const a = arrasteRef.current;
      const delta = Math.round((e.clientY - a.y0) / PX_MIN / passo) * passo;
      if (a.modo === "mover") {
        const dur = a.fim - a.ini;
        const ini = Math.max(0, Math.min(24 * 60 - 1 - dur, a.ini + delta));
        setArraste({ ...a, dIni: ini, dFim: ini + dur, moveu: a.moveu || delta !== 0 });
      } else {
        const fim = Math.max(a.ini + passo, Math.min(24 * 60 - 1, a.fim + delta));
        setArraste({ ...a, dFim: fim, moveu: a.moveu || delta !== 0 });
      }
    }
    function onUp() {
      const a = arrasteRef.current;
      setArraste(null);
      const oc = ocorrencias.find((o) => o.key === a.key);
      if (!oc) return;
      if (!a.moveu) { onAbrir(oc); return; }
      if (a.dIni !== a.ini || a.dFim !== a.fim) onMover(oc, minToHHMM(a.dIni), minToHHMM(oc.tipo === "marco" ? a.dIni : a.dFim));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!arraste]);

  function iniciarArraste(e, oc, modo) {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (!podeEditar) { onAbrir(oc); return; }
    e.preventDefault();
    const ini = hhmmToMin(oc.inicio);
    const fim = hhmmToMin(oc.fim);
    setArraste({ key: oc.key, modo, y0: e.clientY, ini, fim, dIni: ini, dFim: fim, moveu: false });
  }

  function clicarVazio(e) {
    if (!podeEditar) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = inicioMin + Math.floor((e.clientY - rect.top) / PX_MIN / 15) * 15;
    onCriar(minToHHMM(min));
  }

  const marcas = [];
  for (let m = inicioMin; m <= fimMin; m += 30) marcas.push(m);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();

  return (
    <div className="agenda-timeline">
      <div className="agenda-horas" style={{ height: altura }}>
        {marcas.map((m) => (
          <div key={m} className={"agenda-hora" + (m % 60 ? " meia" : "")} style={{ top: (m - inicioMin) * PX_MIN }}>{minToHHMM(m)}</div>
        ))}
      </div>
      <div className={"agenda-grade" + (podeEditar ? " editavel" : "")} style={{ height: altura }} onClick={clicarVazio}>
        {marcas.map((m) => (
          <div key={m} className={"agenda-linha" + (m % 60 ? " meia" : "")} style={{ top: (m - inicioMin) * PX_MIN }} />
        ))}
        <div className="agenda-expediente" style={{ top: (hhmmToMin(cfg.inicio) - inicioMin) * PX_MIN, height: (hhmmToMin(cfg.fim) - hhmmToMin(cfg.inicio)) * PX_MIN }} />
        {calcularColunas(ocorrencias).map(({ oc, ini, fim, col, cols }) => {
          const emArraste = arraste && arraste.key === oc.key;
          const vIni = emArraste ? arraste.dIni : ini;
          const vFim = emArraste ? (oc.tipo === "marco" ? arraste.dIni + MARCO_VISUAL_MIN : arraste.dFim) : fim;
          const st = statusOcorrencia(oc, idx, agora);
          const alturaPx = (vFim - vIni) * PX_MIN;
          const curto = alturaPx < 44;
          const cabeSelo = alturaPx >= 66;
          const horaTxt = oc.tipo === "marco" ? minToHHMM(vIni) : `${minToHHMM(vIni)}–${minToHHMM(emArraste ? arraste.dFim : hhmmToMin(oc.fim))}`;
          return (
            <div
              key={oc.key}
              className={`agenda-bloco st-${st}` + (oc.tipo === "marco" ? " marco" : "") + (emArraste ? " arrastando" : "") + (podeEditar ? " editavel" : "")}
              style={{
                "--bloco-cor": oc.cor,
                top: (vIni - inicioMin) * PX_MIN,
                height: Math.max(18, (vFim - vIni) * PX_MIN - 2),
                left: `calc(${(col / cols) * 100}% + 4px)`,
                width: `calc(${100 / cols}% - 8px)`,
              }}
              onPointerDown={(e) => iniciarArraste(e, oc, "mover")}
              onClick={(e) => e.stopPropagation()}
              title={`${oc.titulo} • ${horaTxt} • ${STATUS_LABEL[st]}`}
            >
              <div className={"agenda-bloco-conteudo" + (curto ? " curto" : "")}>
                <span className="agenda-bloco-titulo">{oc.icone} {oc.titulo}</span>
                <span className="agenda-bloco-hora">{horaTxt}{oc.recorrente ? " ↻" : ""}</span>
                {cabeSelo && <span className={"badge " + STATUS_BADGE[st]} style={{ fontSize: 10 }}>{STATUS_LABEL[st]}</span>}
              </div>
              {podeEditar && oc.tipo !== "marco" && (
                <div className="agenda-bloco-alca" onPointerDown={(e) => iniciarArraste(e, oc, "redimensionar")} />
              )}
            </div>
          );
        })}
        {ehHoje && agoraMin >= inicioMin && agoraMin <= fimMin && (
          <div className="agenda-agora" style={{ top: (agoraMin - inicioMin) * PX_MIN }}><span>{minToHHMM(agoraMin)}</span></div>
        )}
      </div>
    </div>
  );
}

export { STATUS_BADGE };
