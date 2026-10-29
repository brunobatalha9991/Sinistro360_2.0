# Painel de Desempenho (Fase 5)

Status: implementado, escopo simplificado por decisão do usuário.

## Decisões que moldaram o escopo

| Pergunta (auditoria, seção 12) | Resposta | Impacto no desenho |
|---|---|---|
| Equipe/gestor/carteira | Deriva do `role`: admin/atendente = gestor, analista/consulta = equipe. Carteira por usuário `consulta` existe na prática mas não está no sistema. | Sem filtro por carteira nesta fase (dado não existe). Filtro por "grupo" (gestor/equipe) é possível via `role`, não implementado na UI ainda — só usado internamente pela memória da IA (Fase 6). |
| SLA formal | Não existe — "Próxima ação" já é o controle real | Métricas de atraso reaproveitam `isAtrasado()` tal como já existe, sem inventar SLA por etapa/seguradora |
| Escala real | Até 5 usuários ativos | Painel simplificado: 6 métricas por usuário numa tabela única, sem granularidade de equipe/carteira/filial, sem exportação dedicada, sem alertas automáticos de qualidade além do aviso textual de "sem histórico" |

## Métricas implementadas (e por quê essas e não as ~20 do pedido original)

Ver fórmulas exatas em `catalogo-dashboards.md`. Resumo do racional:

- **Processos assumidos** e **sob responsabilidade no período**: só possíveis graças à Fase 2 — sem o histórico de responsabilidade por intervalo, essas duas métricas simplesmente não existiam (o campo antigo só guardava o valor atual).
- **Estoque atual** e **Atrasados**: reaproveitam exatamente a mesma leitura que o resto do app já usa (`getResponsavel`, `isAtrasado`) — garante que os números batem com o que aparece manualmente em Sinistros.
- **Tempo médio de responsabilidade**: a métrica "central" pedida na seção 6 do pedido original ("tempo sob responsabilidade de cada usuário") — calculada só sobre intervalos já encerrados, para não misturar processos ainda em andamento.
- **Sem histórico estruturado**: sinalizador de qualidade de dado (seção 6.4 do pedido original, "processos com histórico inconsistente") — mais honesto que inventar uma métrica sobre dado que não existe.
- Métricas descartadas nesta fase por falta de dado real: taxa de reabertura (não há campo/evento de "reabertura" no sistema), SLA por etapa/seguradora (não existe), estoque ponderado por complexidade (não há campo de complexidade), tudo que dependeria de equipe/carteira/gestor formal.

## Regra de justiça (o requisito central da seção 6 do pedido original)

Um usuário nunca é penalizado por tempo/atraso anterior ao início da sua responsabilidade sobre o processo — garantido pela Fase 2 (`corp_responsabilidade_historico`, intervalos sem sobreposição) e testado explicitamente em `src/logic/desempenho.test.js` ("processo recebido antes da responsabilidade de um usuário não conta tempo anterior a ele").

## Drill-down

Cada linha da tabela tem "Ver sinistros" → navega para Sinistros com o filtro `responsavel` já aplicado (reaproveita `state/listFilter.js`, o mesmo mecanismo do drill-down do Dashboard).

## Permissão

Módulo `desempenho` adicionado a `MODULOS_DISPONIVEIS` — controlado só pelo checkbox de módulos por usuário (mesmo padrão do Assistente IA), sem trava fixa por role. Fica a critério do admin decidir quem vê o painel de desempenho de todos.

## Rollback

Aditivo: nova rota, novo módulo, nova lógica pura (`src/logic/desempenho.js`) e uma nova tool de IA. Nenhum dado existente é lido de forma destrutiva — todas as leituras são somente leitura sobre `corp_claims`, `corp_overrides` e `corp_responsabilidade_historico`. Reverter = remover a entrada do menu/rotas; nenhum dado precisa ser desfeito.

## Como testar

1. `npm test` — cobre a regra de justiça, o filtro de estoque atual (só não finalizados) e o caso sem histórico.
2. Manual: abrir Desempenho, trocar o período, clicar "Ver sinistros" numa linha e confirmar que a lista de Sinistros abre filtrada pelo responsável certo.

## Índice de Desempenho v4 (2026-10-29)

Estudo a pedido do usuário: com os perfis que ele descreveu da equipe, a fórmula v3 dava
99 ("Excelente") a quem estava em treinamento e quase não atuava, 96 a quem
atuou em 14 processos com 27 de 64 sem atualização e 54 a quem atuou em 39
processos. Causas encontradas (reproduzidas em simulação com a própria
`calcularIndice`):

1. Não havia pilar de **produção** nem de **"o que tinha para fazer × o que foi feito"**.
2. Quem não tinha carteira ficava só com Agenda/Assiduidade/Conduta (quase sempre 100).
3. O desconto por pendências era **absoluto** (teto −40): carteira grande = punição máxima.
4. A média simples do pilar Processos escondia 40% da carteira sem atualização.
5. Os ganhos do dia (até +20) repetiam a produção e anulavam o desconto.

Mudanças (código: `logic/desempenhoEntrega.js`, `logic/desempenhoPainel.js`, `logic/desempenhoRitmo.js`):

| Pilar | Peso | Como mede |
|---|---|---|
| Entrega | 30 | Demanda de cada dia reconstruída como estava às 00h (processos da carteira com próxima ação vencida/vencendo e/ou sem atualização há mais de 3 dias) × o que o próprio usuário tratou com histórico no dia (sem histórico = ½; tratado por outro sai da conta). Hoje: proporcional ao expediente já passado. |
| Produção | 15 | Processos diferentes em que atuou por dia ÷ meta (carteira ÷ 3, mínimo `corp_desempenho_cfg.metaMinimaDiaria`, padrão 10). |
| Carteira | 20 | Estado atual, média ponderada (histórico atualizado e próximas ações em dia pesam 2). |
| CI / Agenda / Assiduidade / Conduta | 15 / 10 / 5 / 5 | Como antes; chegada com tolerância configurável (`toleranciaChegadaMin`, padrão 10 min). |

- Desconto das pendências = soma dos pontos × 10 ÷ carteira (mín. 20), teto −20.
- Ganhos do dia: teto +5.
- Pesos salvos antes da v4 (sem `entrega`) são ignorados até alguém salvar de novo.
- Fotos do Ritmo do dia gravam em ids novos (`v4_...`) para abas abertas na versão
  anterior não alternarem fórmulas no mesmo registro (notificações em loop).

Também: card "Demanda de hoje" (item a item, com vínculo) e "O que foi feito"
(linha do tempo de tudo que o usuário fez em processos, CIs e agenda, com
vínculo), em `logic/desempenhoAtividades.js`.
