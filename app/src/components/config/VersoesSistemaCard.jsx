import { useState } from "react";
import { uid } from "../../logic/format";
import {
  TIPOS_MUDANCA, MODULOS_SISTEMA, tipoMudanca, versoesEfetivas, ordenarVersoes, sugerirProximaVersao, contarPorTipo,
  montarHtmlRelatorioVersoes,
} from "../../logic/versoesSistema";
import { imprimirHtml } from "../../logic/solicitacaoPdf";

// Registro de versões/atualizações do sistema + relatório visual pra
// compartilhar (ver logic/versoesSistema.js) — config.corp_versoes_sistema.
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function agoraHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function dataBR(iso) {
  const [y, m, d] = String(iso || "").split("-");
  return d ? `${d}/${m}/${y}` : "—";
}
const itemVazio = () => ({ id: uid("vi"), tipo: "novidade", modulo: "Geral", texto: "" });

export function VersoesSistemaCard({ config, saveConfig, canEdit, currentUser }) {
  const lista = ordenarVersoes(versoesEfetivas(config));
  const [editando, setEditando] = useState(null); // versão em edição (cópia)
  const [aberta, setAberta] = useState(lista[0] ? lista[0].id : null);
  const [sel, setSel] = useState(() => new Set(lista.map((v) => v.id)));
  const [tituloRel, setTituloRel] = useState("Atualizações do Sinistro360");
  const [status, setStatus] = useState(null);

  function gravar(nova) {
    if (!canEdit) { alert("Apenas administradores podem registrar versões."); return; }
    saveConfig("corp_versoes_sistema", nova);
  }
  function novaVersao() {
    setEditando({ id: uid("ver"), versao: sugerirProximaVersao(lista, true), data: hojeISO(), hora: agoraHHMM(), titulo: "", resumo: "", itens: [itemVazio()], nova: true });
    setStatus(null);
  }
  function salvarEdicao() {
    const v = editando;
    if (!String(v.versao || "").trim()) { alert("Informe o número da versão (ex.: 3.5.0)."); return; }
    if (!String(v.titulo || "").trim()) { alert("Informe um título para a versão."); return; }
    const itens = (v.itens || []).filter((i) => String(i.texto || "").trim()).map((i) => ({ ...i, texto: i.texto.trim() }));
    if (!itens.length) { alert("Descreva pelo menos uma mudança."); return; }
    if (lista.some((x) => x.id !== v.id && String(x.versao).trim() === String(v.versao).trim())) { alert(`A versão ${v.versao} já está registrada.`); return; }
    const limpa = { id: v.id, versao: String(v.versao).trim(), data: v.data, hora: v.hora || "", titulo: v.titulo.trim(), resumo: String(v.resumo || "").trim(), itens };
    const nova = v.nova ? [limpa, ...lista] : lista.map((x) => (x.id === v.id ? limpa : x));
    gravar(nova);
    setSel((s) => new Set([...s, limpa.id]));
    setAberta(limpa.id);
    setEditando(null);
    setStatus(`Versão ${limpa.versao} salva.`);
  }
  function excluir(v) {
    if (!confirm(`Excluir o registro da versão ${v.versao} — "${v.titulo}"?`)) return;
    gravar(lista.filter((x) => x.id !== v.id));
    setStatus(`Versão ${v.versao} excluída.`);
  }
  function setItem(idx, patch) {
    setEditando((e) => ({ ...e, itens: e.itens.map((i, k) => (k === idx ? { ...i, ...patch } : i)) }));
  }

  const selecionadas = lista.filter((v) => sel.has(v.id));
  function htmlRelatorio() {
    return montarHtmlRelatorioVersoes(selecionadas, { titulo: tituloRel || "Atualizações do Sinistro360", geradoPor: currentUser && currentUser.nome });
  }
  function previsualizar() {
    const url = URL.createObjectURL(new Blob([htmlRelatorio()], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function baixar() {
    const url = URL.createObjectURL(new Blob([htmlRelatorio()], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `atualizacoes-sinistro360-${hojeISO()}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const cont = contarPorTipo(selecionadas);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Versões do sistema</h3>
        {canEdit && !editando && <button className="btn sm" onClick={novaVersao}>+ Registrar nova versão</button>}
      </div>
      <p className="muted">
        Registre cada atualização publicada e o que mudou (novidades, melhorias e correções, por módulo). Depois, gere um relatório visual para compartilhar com a equipe: pré-visualize, imprima ou salve em PDF, ou baixe em HTML para enviar.
      </p>

      {editando && (
        <div className="versao-form">
          <div className="grid c3">
            <div className="field"><label>Versão</label><input value={editando.versao} onChange={(e) => setEditando({ ...editando, versao: e.target.value })} placeholder="3.5.0" /></div>
            <div className="field"><label>Data</label><input type="date" value={editando.data} onChange={(e) => setEditando({ ...editando, data: e.target.value })} /></div>
            <div className="field"><label>Hora</label><input type="time" value={editando.hora || ""} onChange={(e) => setEditando({ ...editando, hora: e.target.value })} /></div>
          </div>
          <div className="field"><label>Título</label><input value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} placeholder="Ex.: Notificações mais inteligentes" /></div>
          <div className="field"><label>Resumo (uma ou duas frases para todos entenderem)</label><textarea rows={2} value={editando.resumo} onChange={(e) => setEditando({ ...editando, resumo: e.target.value })} /></div>
          <label>O que mudou</label>
          <div className="versao-itens">
            {editando.itens.map((i, idx) => (
              <div key={i.id} className="versao-item-edit">
                <select value={i.tipo} onChange={(e) => setItem(idx, { tipo: e.target.value })}>
                  {TIPOS_MUDANCA.map((t) => <option key={t.key} value={t.key}>{t.icone} {t.label}</option>)}
                </select>
                <select value={i.modulo} onChange={(e) => setItem(idx, { modulo: e.target.value })}>
                  {MODULOS_SISTEMA.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <textarea rows={2} value={i.texto} placeholder="Descreva a mudança em linguagem de usuário..." onChange={(e) => setItem(idx, { texto: e.target.value })} />
                <button type="button" className="btn sec xs" title="Remover esta mudança" onClick={() => setEditando((e) => ({ ...e, itens: e.itens.filter((_, k) => k !== idx) }))}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" className="btn sec xs" onClick={() => setEditando((e) => ({ ...e, itens: [...e.itens, itemVazio()] }))}>+ Adicionar mudança</button>
            {editando.nova && (
              <button type="button" className="btn ghost xs" onClick={() => setEditando((e) => ({ ...e, versao: sugerirProximaVersao(lista, e.itens.some((x) => x.tipo === "novidade")) }))}>
                Sugerir número pela regra (novidade → 3.X.0; só melhoria/correção → 3.4.X)
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn sm" onClick={salvarEdicao}>Salvar versão</button>
            <button className="btn sec sm" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="versoes-lista">
        {!lista.length && <p className="muted">Nenhuma versão registrada.</p>}
        {lista.map((v, idx) => {
          const c = contarPorTipo([v]);
          const exp = aberta === v.id;
          return (
            <div key={v.id} className={"versao-linha" + (idx === 0 ? " atual" : "")}>
              <div className="versao-cab">
                <input type="checkbox" className="versao-check" checked={sel.has(v.id)} title="Incluir no relatório"
                  onChange={() => setSel((s) => { const n = new Set(s); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n; })} />
                <button type="button" className="versao-titulo" onClick={() => setAberta(exp ? null : v.id)}>
                  <span className="versao-num">v{v.versao}</span>
                  <b>{v.titulo}</b>
                  <span className="muted" style={{ fontSize: 12 }}>{dataBR(v.data)}{v.hora ? " • " + v.hora : ""}</span>
                  {idx === 0 && <span className="badge purple">atual</span>}
                  <span className="versao-contagens">
                    {TIPOS_MUDANCA.filter((t) => c[t.key]).map((t) => <span key={t.key} style={{ color: t.cor }}>{t.icone}{c[t.key]}</span>)}
                  </span>
                </button>
                {canEdit && !editando && (
                  <span style={{ display: "flex", gap: 4 }}>
                    <button type="button" className="btn sec xs" onClick={() => setEditando({ ...v, itens: (v.itens || []).map((i) => ({ ...i })) })}>Editar</button>
                    <button type="button" className="btn danger xs" onClick={() => excluir(v)}>Excluir</button>
                  </span>
                )}
              </div>
              {exp && (
                <div className="versao-detalhe">
                  {v.resumo && <p style={{ margin: "0 0 8px" }}>{v.resumo}</p>}
                  {(v.itens || []).map((i) => {
                    const t = tipoMudanca(i.tipo);
                    return (
                      <div key={i.id} className="versao-item">
                        <span className="versao-tag" style={{ background: t.cor }}>{t.icone} {t.label}</span>
                        <span className="muted" style={{ fontSize: 11.5, fontWeight: 700 }}>{i.modulo}</span>
                        <span>{i.texto}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="versao-relatorio">
        <h4 style={{ margin: "0 0 6px" }}>📊 Relatório visual das atualizações</h4>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
          {selecionadas.length} versão(ões) selecionada(s) • {cont.novidade} novidade(s) • {cont.melhoria} melhoria(s) • {cont.correcao} correção(ões)
          {" "}— <a onClick={() => setSel(new Set(lista.map((v) => v.id)))}>marcar todas</a> • <a onClick={() => setSel(new Set())}>desmarcar</a>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ maxWidth: 320 }} value={tituloRel} onChange={(e) => setTituloRel(e.target.value)} placeholder="Título do relatório" />
          <button className="btn sm" disabled={!selecionadas.length} onClick={previsualizar}>👁 Pré-visualizar</button>
          <button className="btn sec sm" disabled={!selecionadas.length} onClick={() => imprimirHtml(htmlRelatorio())}>🖨 Imprimir / PDF</button>
          <button className="btn sec sm" disabled={!selecionadas.length} onClick={baixar}>⬇️ Baixar HTML</button>
        </div>
      </div>
      {status && <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{status}</p>}
    </div>
  );
}
