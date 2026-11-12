import { useMemo, useState } from "react";
import { useData } from "../../data/DataProvider.jsx";
import { useAuth } from "../../hooks/useAuth";
import { visibleClaims } from "../../logic/claims";
import { fmtDateBR, fmtDateHoraBR } from "../../logic/format";
import {
  montarRelatorioSinistros, gravarLeitura, CHAVE_LEITURAS, NOTA_SEGURADORAS, SEM_RESPONSAVEL, rotuloTermometro,
} from "../../logic/relatorioSinistros";
import { RelatorioHeader } from "./RelatorioBase.jsx";
import { useImpressaoRelatorio } from "../../hooks/useImpressaoRelatorio";

// Relatório de Sinistros (modelo "edição da noite", a pedido do usuário) —
// gerado na hora com os dados do sistema, quantas vezes quiser. A lógica
// fica em logic/relatorioSinistros.js; aqui só o desenho (tela = PDF).

const TITULO = "Relatório de Sinistros";
const d = (v) => (v == null ? "—" : `${v} d`);
const n = (v) => (v == null ? "—" : String(v));

function Termo({ k }) {
  return <span className={"rs-termo " + k}>{rotuloTermometro(k)}</span>;
}
function Prazo({ l }) {
  if (l.prazo === "semprazo") return <span className="rs-prazo sem">Sem prazo</span>;
  const rot = l.prazo === "atrasado" ? `Atrasado ${l.diasAtraso} d` : l.prazo === "hoje" ? "Vence hoje" : "No prazo";
  return <><span className={"rs-prazo " + l.prazo}>{rot}</span><div className="rs-sub">{fmtDateBR(l.prazoData)}</div></>;
}
function Secao({ titulo, children }) {
  return <section className="rs-secao"><h3 className="rs-sec-titulo">{titulo}</h3>{children}</section>;
}
function Contagens({ itens }) {
  if (!itens.length) return <div className="muted">—</div>;
  return (
    <table className="rs-tab rs-contagem">
      <thead><tr>{itens.map(([k]) => <th key={k}>{k}</th>)}</tr></thead>
      <tbody><tr>{itens.map(([k, v]) => <td key={k} className="num">{v}</td>)}</tr></tbody>
    </table>
  );
}

function TabelaAlerta({ linhas }) {
  if (!linhas.length) return <div className="muted rs-vazio">Nenhum processo.</div>;
  return (
    <table className="rs-tab">
      <thead><tr><th>Nº</th><th>Segurado</th><th>Seg.</th><th>Responsável</th><th>Termômetro</th><th>Etapa</th><th>Próxima ação</th><th>Prazo</th></tr></thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.id}>
            <td className="mono">{l.numero}</td><td>{l.segurado}</td><td>{l.seguradora}</td><td>{l.responsavel}</td>
            <td><Termo k={l.termometro} /></td><td>{l.etapa}</td><td>{l.proxTitulo || "—"}</td>
            <td className="nowrap">{l.prazoData ? `${fmtDateBR(l.prazoData)} (${l.prazo === "atrasado" ? `Atrasado ${l.diasAtraso} d` : l.prazo === "hoje" ? "Vence hoje" : "No prazo"})` : "Sem prazo"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaDemanda({ linhas }) {
  return (
    <table className="rs-tab rs-demanda">
      <thead><tr><th>Nº</th><th>Segurado</th><th>Seg.</th><th>Tipo</th><th>Etapa / situação</th><th>Termôm.</th><th>Último histórico</th><th>Próxima ação</th><th>Prazo</th><th>Aberto</th><th>Na etapa</th></tr></thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.id}>
            <td className="mono">{l.numero}</td>
            <td>{l.segurado}</td>
            <td>{l.seguradora}</td>
            <td>{l.tipo}</td>
            <td>{l.etapa}{l.sitAtend && <div className="rs-sub">{l.sitAtend}</div>}</td>
            <td><Termo k={l.termometro} /></td>
            <td className="rs-hist">{l.ultHistTexto ? <>{l.ultHistData && <span className="rs-sub">{fmtDateBR(l.ultHistData)} • </span>}{l.ultHistTexto}</> : <span className="muted">Sem histórico registrado</span>}</td>
            <td>{l.proxTitulo || "—"}</td>
            <td className="nowrap"><Prazo l={l} /></td>
            <td className="num">{d(l.diasAberto)}</td>
            <td className="num">{d(l.diasEtapa)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RelatorioSinistros({ onVoltar }) {
  const { records, config, saveConfig } = useData();
  const { currentUser } = useAuth();
  const [agora, setAgora] = useState(() => new Date());
  const [gravado, setGravado] = useState("");
  const { printing, imprimir } = useImpressaoRelatorio();
  const overrides = records.corp_overrides || {};
  const leituras = config[CHAVE_LEITURAS];

  const rel = useMemo(() => montarRelatorioSinistros({
    claims: visibleClaims(records.corp_claims, overrides, currentUser),
    overrides, tasks: records.corp_tasks, users: records.corp_users,
    atendTemplate: config.corp_atendimento_template, templates: config.corp_journey_templates || {},
    agora, leituras,
  }), [records.corp_claims, records.corp_tasks, records.corp_users, overrides, currentUser, config.corp_atendimento_template, config.corp_journey_templates, agora, leituras]);

  const t = rel.total;
  const ind = rel.indicadores;
  const pct = t.processos ? Math.round((t.atrasados / t.processos) * 100) : 0;
  const hojeBR = fmtDateBR(rel.hojeISO);
  const hora = `${String(agora.getHours()).padStart(2, "0")}h${String(agora.getMinutes()).padStart(2, "0")}`;

  function atualizar() { setAgora(new Date()); setGravado(""); }
  function gravar() {
    saveConfig(CHAVE_LEITURAS, (cur) => gravarLeitura(cur, rel, new Date()));
    setGravado(`Leitura de ${hojeBR} gravada às ${hora} — a próxima emissão (em outro dia) compara com ela.`);
  }

  const cards = [
    [t.processos, "Em aberto"], [t.atrasados, "Atrasados"], [t.hoje, "Vencem hoje"], [t.noprazo, "No prazo"],
    [t.semprazo, "Sem prazo"], [t.grave, "Graves"], [t.atencao, "Em atenção"], [t.semTermo, "Sem termômetro"],
  ];
  const indic = [
    ["Segurados", n(ind.segurados)], ["Terceiros", n(ind.terceiros)], ["Atendimentos / assistências", n(ind.atendimentos)],
    ["Situação: Em andamento", n(ind.emAndamento)], ["Situação: Pendente", n(ind.pendente)], ["Termômetro Moderado", n(ind.moderado)],
    ["Atraso médio da próxima ação", d(ind.atrasoMedio)], ["Maior atraso", d(ind.maiorAtraso)], ["Atrasados há mais de 30 dias", n(ind.atrasados30)],
    ["Tempo médio em aberto", ind.mediaAberto == null ? "—" : `${ind.mediaAberto} d (${ind.comDadoAberto} com dado)`], ["Tempo médio na mesma etapa", d(ind.mediaEtapa)], ["Maior tempo na mesma etapa", d(ind.maiorEtapa)],
    ["Dias médios desde o último histórico", d(ind.mediaSemHistorico)], ["Sem contato registrado há mais de 7 dias", n(ind.semContato7)], ["Sem histórico registrado", n(ind.semHistorico)],
  ];
  const indicLinhas = [];
  for (let i = 0; i < indic.length; i += 3) indicLinhas.push(indic.slice(i, i + 3));

  return (
    <div className={"page-enter" + (printing ? " rs-imprimindo" : "")}>
      <RelatorioHeader
        titulo={TITULO} descricao="Fotografia dos processos em aberto, demanda por operador, alertas, CIs e previsto para o próximo dia útil — gerado com os dados atuais do sistema."
        onVoltar={onVoltar} onPdf={imprimir} desabilitado={!t.processos}
      />
      <div className="rs-acoes">
        <button type="button" className="btn sec sm" onClick={atualizar}>🔄 Atualizar leitura</button>
        <button type="button" className="btn sec sm" onClick={gravar} title="Guarda os números de hoje para a comparação da próxima emissão">💾 Gravar leitura de hoje</button>
        {gravado && <span className="muted" style={{ fontSize: 12.5 }}>✓ {gravado}</span>}
      </div>

      <div className="rs-relatorio">
        <header className="rs-cabecalho">
          <h2>Relatório de Sinistros – {hojeBR}</h2>
          <div className="rs-sub">Leitura do Sinistro360 às {hora}{currentUser && currentUser.nome ? ` por ${currentUser.nome}` : ""} ({t.processos} processos em aberto). Prazos contados até {hojeBR}.</div>
        </header>

        <div className="rs-cards">
          {cards.map(([v, l]) => <div key={l} className="rs-card"><b>{v}</b><span>{l}</span></div>)}
        </div>

        <div className="rs-destaque">
          <b>Leitura do que o número diz:</b> {t.atrasados} de {t.processos} processos estão com a próxima ação atrasada ({pct}%).
          {" "}{t.semTermo} não têm termômetro definido e {ind.semHistorico} não têm nenhum histórico registrado. As CIs estão na seção 5.
        </div>

        <Secao titulo="1. Totalizadores e indicadores">
          <table className="rs-tab rs-indic">
            <thead><tr><th>Indicador</th><th>Valor</th><th>Indicador</th><th>Valor</th><th>Indicador</th><th>Valor</th></tr></thead>
            <tbody>
              {indicLinhas.map((ls, i) => (
                <tr key={i}>{ls.map(([k, v]) => [<td key={k}>{k}</td>, <td key={k + "v"} className="num"><b>{v}</b></td>])}</tr>
              ))}
            </tbody>
          </table>
          <p className="rs-nota">{NOTA_SEGURADORAS}</p>
          <h4 className="rs-subtitulo">Por seguradora</h4>
          <Contagens itens={rel.porSeguradora} />
          <h4 className="rs-subtitulo">Por etapa da jornada</h4>
          <Contagens itens={rel.porEtapa} />
        </Secao>

        <Secao titulo="2. Processos sob demanda de cada operador">
          <table className="rs-tab">
            <thead><tr><th>Operador</th><th>Processos</th><th>Atrasados</th><th>Vencem hoje</th><th>No prazo</th><th>Sem prazo</th><th>Grave</th><th>Em atenção</th><th>Moderado</th><th>Tranq.</th><th>S/ term.</th><th>Atraso médio</th><th>Média em aberto</th><th>Maior em aberto</th><th>Média na etapa</th><th>Maior na etapa</th></tr></thead>
            <tbody>
              {[...rel.operadores.map((o) => [o.nome, o.resumo]), ["Total", t]].map(([nome, r]) => (
                <tr key={nome} className={nome === "Total" ? "rs-total" : ""}>
                  <td><b>{nome}</b></td><td className="num"><b>{r.processos}</b></td><td className="num">{r.atrasados}</td><td className="num">{r.hoje}</td>
                  <td className="num">{r.noprazo}</td><td className="num">{r.semprazo}</td><td className="num">{r.grave}</td><td className="num">{r.atencao}</td>
                  <td className="num">{r.moderado}</td><td className="num">{r.tranquilo}</td><td className="num">{r.semTermo}</td><td className="num">{d(r.atrasoMedio)}</td>
                  <td className="num">{d(r.mediaAberto)}</td><td className="num">{d(r.maiorAberto)}</td><td className="num">{d(r.mediaEtapa)}</td><td className="num">{d(r.maiorEtapa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rs-nota">Operadores = campo Responsável de cada processo. Tempo em aberto conta da data de aviso (ou criação) até hoje; na etapa, desde a entrada na etapa atual da jornada.</p>
        </Secao>

        <Secao titulo="3. Alertas para agir hoje">
          <h4 className="rs-subtitulo">Termômetro Grave ({rel.alertas.graves.length})</h4>
          <TabelaAlerta linhas={rel.alertas.graves} />
          <h4 className="rs-subtitulo">Termômetro Em atenção ({rel.alertas.emAtencao.length})</h4>
          <TabelaAlerta linhas={rel.alertas.emAtencao} />
          <h4 className="rs-subtitulo">Atrasados há mais de 30 dias ({rel.alertas.atrasados30.length})</h4>
          <TabelaAlerta linhas={rel.alertas.atrasados30} />
        </Secao>

        <Secao titulo="4. Demanda por demanda, por operador">
          <p className="rs-nota">Ordem: atrasados (mais antigos primeiro), vencem hoje, no prazo, sem prazo; em cada grupo, termômetro mais grave primeiro.</p>
          {rel.operadores.map((o) => (
            <div key={o.nome} className="rs-operador">
              <h4 className="rs-subtitulo">{o.nome}: {o.resumo.processos} processos ({o.resumo.atrasados} atrasados, {o.resumo.hoje} vencem hoje, {o.resumo.noprazo} no prazo, {o.resumo.semprazo} sem prazo)</h4>
              <TabelaDemanda linhas={o.linhas} />
            </div>
          ))}
        </Secao>

        <Secao titulo="5. CIs (Comunicação Interna) em aberto">
          <p className="rs-nota">{rel.cis.length} CIs abertas na leitura das {hora}.</p>
          {rel.cis.length ? (
            <table className="rs-tab">
              <thead><tr><th>CI</th><th>Assunto</th><th>Responsável</th><th>Aberta em</th><th>Última interação</th></tr></thead>
              <tbody>
                {rel.cis.map((c) => (
                  <tr key={c.id}><td className="mono nowrap">{c.ci}</td><td>{c.assunto || "—"}</td><td>{c.responsavel}</td><td className="nowrap">{c.abertaEm ? fmtDateHoraBR(c.abertaEm) : "—"}</td><td className="nowrap">{c.ultima ? fmtDateHoraBR(c.ultima) : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted rs-vazio">Nenhuma CI em aberto.</div>}
          <h4 className="rs-subtitulo">CIs por responsável</h4>
          <Contagens itens={rel.cisPorResponsavel} />
        </Secao>

        <Secao titulo={rel.comparativo ? `Resultado de hoje (${hojeBR}) comparado com a última leitura gravada (${fmtDateBR(rel.comparativo.data)})` : "Resultado de hoje comparado com a última leitura gravada"}>
          {rel.comparativo ? (
            <table className="rs-tab">
              <thead><tr><th>Indicador</th><th>Leitura anterior</th><th>Agora</th><th>Variação</th></tr></thead>
              <tbody>
                {rel.comparativo.linhas.map((l) => (
                  <tr key={l.label}>
                    <td>{l.label}</td><td className="num">{n(l.antes)}</td><td className="num"><b>{l.agora}</b></td>
                    <td className={"num " + (l.variacao > 0 ? "rs-pior" : l.variacao < 0 ? "rs-melhor" : "")}>{l.variacao == null ? "—" : (l.variacao > 0 ? "+" : l.variacao === 0 ? "+" : "") + l.variacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="muted rs-vazio">Ainda não há leitura gravada de um dia anterior. Use "💾 Gravar leitura de hoje" ao fim do dia — a próxima emissão compara com ela.</div>
          )}
        </Secao>

        <Secao titulo={`Previsto para ${fmtDateBR(rel.previsto.data)} (próximo dia útil)`}>
          <div className="rs-destaque">
            <b>{rel.previsto.linhas.length}</b> processos com próxima ação vencendo em {fmtDateBR(rel.previsto.data)} e <b>{t.atrasados}</b> atrasados que seguem para o próximo dia.
          </div>
          <table className="rs-tab">
            <thead><tr><th>Operador</th><th>Vencem em {fmtDateBR(rel.previsto.data)}</th><th>Atrasados que ficam</th></tr></thead>
            <tbody>
              {rel.previsto.porOperador.map((o) => <tr key={o.nome}><td>{o.nome}</td><td className="num">{o.vencem}</td><td className="num">{o.atrasados}</td></tr>)}
            </tbody>
          </table>
          <h4 className="rs-subtitulo">Processos com próxima ação em {fmtDateBR(rel.previsto.data)} (por operador)</h4>
          {rel.previsto.linhas.length ? (
            <table className="rs-tab">
              <thead><tr><th>Nº</th><th>Segurado</th><th>Seg.</th><th>Responsável</th><th>Etapa</th><th>Próxima ação</th><th>Termôm.</th></tr></thead>
              <tbody>
                {rel.previsto.linhas.map((l) => (
                  <tr key={l.id}><td className="mono">{l.numero}</td><td>{l.segurado}</td><td>{l.seguradora}</td><td>{l.responsavel === SEM_RESPONSAVEL ? <i>{l.responsavel}</i> : l.responsavel}</td><td>{l.etapa}</td><td>{l.proxTitulo || "—"}</td><td><Termo k={l.termometro} /></td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted rs-vazio">Nenhum processo com próxima ação nesse dia.</div>}
        </Secao>

        <footer className="rs-rodape">Sinistro360 • Relatório de Sinistros • gerado em {fmtDateHoraBR(rel.geradoEm)}</footer>
      </div>
    </div>
  );
}
