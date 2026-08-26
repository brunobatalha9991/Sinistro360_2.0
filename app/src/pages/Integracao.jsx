import { useState } from "react";
import { useData } from "../data/DataProvider.jsx";
import { useAuth } from "../hooks/useAuth";
import { visibleClaims } from "../logic/claims";
import { todayISO } from "../logic/format";
import { testConnection, syncAll } from "../logic/corpApi";

function fieldsToBR(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function Integracao() {
  const { records, config, saveRecord, saveConfig } = useData();
  const { currentUser } = useAuth();
  const cfg = config.corp_cfg || {};
  const claims = visibleClaims(records.corp_claims, records.corp_overrides, currentUser);

  const [url, setUrl] = useState(cfg.url || "");
  const [aplicacao, setAplicacao] = useState(cfg.aplicacao || "");
  const [email, setEmail] = useState(cfg.email || "");
  const [senha, setSenha] = useState(cfg.senha || "");
  const umAno = new Date(); umAno.setFullYear(umAno.getFullYear() - 1);
  const [dataInicial, setDataInicial] = useState(umAno.toISOString().slice(0, 10));
  const [dataFinal, setDataFinal] = useState(todayISO());
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  function collect() { return { url: url.trim(), email: email.trim(), senha: senha.trim(), aplicacao: aplicacao.trim() || "0" }; }
  function salvarConexao() { saveConfig("corp_cfg", collect()); setStatus({ cls: "ok", msg: "Configuração salva." }); }
  function testarConexao() {
    saveConfig("corp_cfg", collect());
    setStatus({ cls: "info", msg: "Testando...", spin: true });
    testConnection(collect()).then(() => setStatus({ cls: "ok", msg: "✔ Conexão OK!" }))
      .catch((e) => setStatus({ cls: "err", msg: "✗ Falha: " + e.message }));
  }
  function setPeriodo(anos) {
    const hj = new Date(), ini = new Date(); ini.setFullYear(hj.getFullYear() - anos);
    setDataFinal(hj.toISOString().slice(0, 10));
    setDataInicial(ini.toISOString().slice(0, 10));
  }
  function sincronizar() {
    if (window.__s360RecordsReady === false) {
      setStatus({ cls: "err", msg: "Aguarde alguns segundos: o sistema ainda está carregando os dados existentes do Firebase. Tente sincronizar de novo em instantes." });
      return;
    }
    const cfgAtual = collect();
    saveConfig("corp_cfg", cfgAtual);
    const di = fieldsToBR(dataInicial), df = fieldsToBR(dataFinal);
    if (!di || !df) { setStatus({ cls: "err", msg: "Selecione data inicial e final." }); return; }
    setSyncing(true);
    setStatus({ cls: "info", msg: `Buscando sinistros de ${di} a ${df}...`, spin: true });
    syncAll(
      cfgAtual, records.corp_claims || [], config.corp_journey_templates || {},
      (next) => saveConfig("corp_journey_templates", next),
      (next) => saveRecord("corp_claims", next),
      { data_inicial: di, data_final: df }
    ).then((res) => {
      setStatus({ cls: "ok", msg: `✔ Concluído! ${res.total} registros no período (${res.novos} carregados${res.descartados ? `, ${res.descartados} de fora do período removidos` : ""}). Processos manuais e edições preservados.` });
      setSyncing(false);
    }).catch((e) => {
      setStatus({ cls: "err", msg: `✗ Erro: ${e.message}${e.status ? ` (HTTP ${e.status})` : ""}` });
      setSyncing(false);
    });
  }
  function limparRegistrosApi() {
    if (!confirm("Apagar os registros da API? Suas edições manuais NÃO serão apagadas.")) return;
    saveRecord("corp_claims", (current) => (current || []).filter((c) => c.origem === "manual"));
  }

  return (
    <div className="page-enter">
      <div className="page-head"><div><h1>Integração CORP</h1><p>Conecte-se à API e sincronize por período</p></div></div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Conexão com a API CORP</h3>
        <div className="grid c2">
          <div className="field"><label>URL base da API</label><input placeholder="https://api.corpnuvem.com" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <div className="field"><label>Aplicação</label><input type="number" placeholder="0" value={aplicacao} onChange={(e) => setAplicacao(e.target.value)} /></div>
        </div>
        <div className="grid c2">
          <div className="field"><label>E-mail / Login</label><input placeholder="usuario@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label>Senha</label><input type="password" placeholder="••••••" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
        </div>
        <button className="btn ghost" onClick={testarConexao}>Testar conexão</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Período da sincronização</h3>
        <p className="muted">Escolha o intervalo (por data de ocorrência). Só serão sincronizados os processos dentro do período — evita puxar processos antigos desnecessários.</p>
        <div className="grid c2">
          <div className="field"><label>Data inicial</label><input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} /></div>
          <div className="field"><label>Data final</label><input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="btn sec xs" onClick={() => setPeriodo(1)}>Último ano</button>
          <button className="btn sec xs" onClick={() => setPeriodo(2)}>Últimos 2 anos</button>
          <button className="btn sec xs" onClick={() => setPeriodo(3)}>Últimos 3 anos</button>
          <button className="btn sec xs" onClick={() => setPeriodo(5)}>Últimos 5 anos</button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button className="btn sec" onClick={salvarConexao}>Salvar conexão</button>
          <button className="btn" disabled={syncing} onClick={sincronizar}>{syncing ? <>Sincronizando... <span className="spin" /></> : "↻ Sincronizar período selecionado"}</button>
        </div>
        {status && <div className={"status " + status.cls}>{status.msg}{status.spin && <span className="spin" />}</div>}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sobre a sincronização</h3>
        <p className="muted">Puxa os três tipos (Segurado, Aviso, Terceiro) no período escolhido. Dados manuais (jornada, vínculos) ficam separados e são preservados.</p>
        <p className="muted">Total armazenado: {claims.length} registros.</p>
        {claims.length > 0 && <button className="btn sec sm" onClick={limparRegistrosApi}>Limpar registros da API (mantém edições manuais)</button>}
      </div>
    </div>
  );
}
