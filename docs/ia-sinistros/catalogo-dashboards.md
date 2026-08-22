# Catálogo de Dashboards e KPIs (Fase 4)

Fonte única de verdade: `app/src/ai/catalog/dashboards.js` (também usada pela tool `explicar_dashboard`). Toda fórmula abaixo foi conferida linha a linha contra o código na auditoria inicial — nenhum valor "mágico" foi encontrado.

## Dashboard (`src/pages/Dashboard.jsx`)

| Indicador | Fórmula | Fonte |
|---|---|---|
| Sinistros no recorte | `rows.length` após `dashFilter` | `corp_claims` |
| Em andamento / Indenizados / Sem indenização / Pendentes / Negados | contagem por `situacaoEfetiva(overrides, c).label` | `corp_claims` + `corp_overrides` |
| Taxa de indenização | `indenizados / total * 100` | calculado |
| Atrasados | `isAtrasado()`: `nextAction.date < hoje` | `corp_overrides.nextAction` |
| Sem atualização | `isSemAtualizacao()`: sem comms ou último comm há mais de 3 dias corridos | `corp_overrides.comms` — **limitação**: dias corridos fixos, sem calendário de feriados |
| Financeiro (avaliado/indenizado/franquias/ticket médio) | soma de `valavi`/`valind`/`franquia`; ticket médio = `totalIndenizado / indenizados` | `corp_claims` |
| TMA (tempo médio de abertura) | média de `diasEntre(datoco, datavi)` | `corp_claims` |
| TME (tempo médio de encerramento) | média de `diasEntre(datavi, datenc)` | `corp_claims` |
| TMR (tempo médio de reparo) | média de `diasEntre(datavi, conclusão)`, só Perda Parcial | `corp_overrides.journeyUser` |
| Distribuição por Situação/Tipo | contagem por `situacaoEfetiva`/`partyType` | `corp_claims` + `corp_overrides` |
| Funil por Etapa | contagem por `currentStage()` | `corp_claims` + templates de jornada |
| Evolução mensal (12m) | contagem por mês de `datoco` (abertos) e `datenc` (encerrados) | `corp_claims` |
| Top 10 Oficinas/Seguradoras | `buildAggregation()` por oficina/seguradora, ordenado por contagem | `corp_claims` + `corp_overrides` |
| Desempenho por Oficina/Seguradora/Ramo | `buildAggregation()`: count, TMA, TME, TMR, valores, % atraso, taxa de indenização | `corp_claims` + `corp_overrides` |
| Sinistros mais críticos | atrasados, ordenados por data da próxima ação, limitado a 8 | `corp_claims` + `corp_overrides` |

Todo gráfico/linha tem drill-down (clicar navega para Sinistros já filtrado).

## Relatórios (`src/pages/Relatorios.jsx`)

| Indicador | Fórmula | Fonte |
|---|---|---|
| Por situação | contagem por `mapSituacao(c.situacao).label` — situação **bruta** da API | `corp_claims` |
| Por seguradora | contagem por `c.cia` — valor **bruto**, não efetivo | `corp_claims` |

**Diferença importante**: Relatórios usa valores brutos da API CORP; Dashboard usa valores efetivos (considerando overrides do usuário). A IA foi instruída (via este catálogo) a nunca confundir os dois ao responder.

## Desempenho (`src/pages/Desempenho.jsx`) — Fase 5

| Indicador | Fórmula | Fonte |
|---|---|---|
| Processos assumidos no período | nº de intervalos de `corp_responsabilidade_historico` do usuário iniciados dentro do período | `corp_responsabilidade_historico` |
| Processos sob responsabilidade no período | nº de sinistros distintos com pelo menos 1 intervalo do usuário sobrepondo o período | `corp_responsabilidade_historico` |
| Estoque atual | sinistros com responsável **vigente** = usuário e situação não finalizada | `corp_overrides.responsavelUser` |
| Atrasados no estoque atual | subconjunto do estoque atual com `isAtrasado()` | `corp_overrides` |
| Tempo médio de responsabilidade | média de duração dos intervalos já encerrados no período, em dias | `corp_responsabilidade_historico` |
| Processos sem histórico estruturado | sinistros do estoque atual sem nenhum intervalo registrado | `corp_responsabilidade_historico` — sinaliza qualidade de dado incompleta |

Ver `metricas-desempenho.md` para as decisões de negócio por trás dessas fórmulas (timezone, definição de "responsável no dia", regra de justiça).
