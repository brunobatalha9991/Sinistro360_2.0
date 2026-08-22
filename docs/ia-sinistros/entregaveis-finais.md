# Entregáveis Finais — Fases 1 a 6 (IA Corporativa Sinistros 360)

## 1. Migrations/coleções de dados criadas (todas aditivas — nenhuma existente alterada/removida)

| Coleção | Fase | Conteúdo |
|---|---|---|
| `corp_responsabilidade_historico` | 2 | Intervalos de vigência de responsável por sinistro |
| `corp_ai_auditoria` | 3 | Log de cada interação com o Assistente IA |
| `corp_ai_memorias` | 6 | Memória controlada (pessoal/equipe/organizacional) |
| `corp_ai_feedback` | 6 | Avaliações do usuário sobre respostas da IA |

Sem sistema de migrations tradicional (não existe neste projeto — ver auditoria-inicial.md); evolução é feita adicionando chaves em `src/data/schema.js`, com leitura retrocompatível (chave ausente = array vazio, nunca erro).

## 2. Ferramentas de IA (function calling, `src/ai/tools/`)

| Tool | Tipo | Fase |
|---|---|---|
| `search_claims` | leitura | 1ª entrega (antes destas fases) |
| `report_claims_summary` | leitura | 1ª entrega |
| `create_task` | escrita, exige confirmação | 1ª entrega |
| `update_claim_field` | escrita, exige confirmação | 1ª entrega |
| `listar_filtros_modulo` | leitura | 4 |
| `explicar_dashboard` | leitura | 4 |
| `analisar_desempenho_usuario` | leitura | 5 |

## 3. Componentes/telas criados ou alterados

**Páginas novas**: `Assistente.jsx` (1ª entrega), `Desempenho.jsx` (Fase 5).
**Páginas editadas**: `Sinistro.jsx` (nova aba Histórico de Responsabilidade, Fase 2), `Configuracoes.jsx` (cards de migração de responsabilidade e aprovação de memórias, Fases 2 e 6), `Abertura.jsx` (motivo mais descritivo, Fase 2).
**Componentes novos**: `ActionProposalCard.jsx` (1ª entrega), `ResponsabilidadePanel.jsx` e `ResponsabilidadeBackfillCard.jsx` (Fase 2), `MemoriasIACard.jsx`, `FeedbackButtons.jsx`, `EnsinarAssistente.jsx` (Fase 6).
**Infra de menu/rotas/permissão**: `pages/index.js`, `components/Shell.jsx`, `components/icons.jsx`, `data/auth.js` (entradas `assistente` e `desempenho`).

## 4. Testes criados

3 arquivos, 22 testes automatizados (vitest, introduzido nesta rodada — não havia framework de teste antes):
- `src/logic/responsabilidade.test.js` (11) — regras da Fase 2 (sem sobreposição, encerramento correto, idempotência, não atribuição antes do início da responsabilidade, backfill).
- `src/logic/desempenho.test.js` — regra de justiça (Fase 5): tempo anterior à responsabilidade não é atribuído, estoque atual só conta não-finalizados.
- `src/logic/memoriaIA.test.js` — visibilidade por escopo, autoaprovação pessoal, pendência de equipe/organizacional (Fase 6).

`npm test`, `npm run lint`, `npm run build` executados e verdes a cada fase desta entrega.

## 5. Variáveis de ambiente necessárias

Nenhuma nova nas Fases 2–6. As já existentes (1ª entrega): `VITE_GEMINI_API_KEY`, `VITE_GEMINI_MODEL` (`app/.env.local` local, secret `VITE_GEMINI_API_KEY` no GitHub Actions para o site publicado).

## 6. Plano de rollout

1. Revisar o diff (16+ arquivos entre as fases).
2. `npm test && npm run lint && npm run build` — já validado nesta entrega.
3. Push em `master` → dispara o deploy automático (`.github/workflows/deploy.yml`).
4. Validar manualmente no navegador os roteiros de "Como testar" de cada doc de fase (`regras-responsabilidade.md`, `arquitetura-ia.md`, `metricas-desempenho.md`, `memoria-e-feedback.md`) — **não executado nesta sessão** por falta de ferramentas de navegador habilitadas.
5. Comunicar às equipes usando `manual-do-usuario.md`.

## 7. Plano de rollback

Ver `plano-de-rollback.md` — resumo: tudo é aditivo, reverter qualquer fase não afeta dado existente.

## 8. Pontos que exigem validação do gestor da corretora

1. Confirmar se a API CORP real envia CPF/CNPJ/dados bancários não capturados hoje (LGPD — pergunta 10 da auditoria, ainda aberta).
2. Decidir se/quando modelar "carteira por usuário `consulta`" (gap identificado na resposta da pergunta 3).
3. Validar a definição de "responsável no momento da ação" e revisar as primeiras estimativas de backfill contra casos reais conhecidos da operação.
4. Decidir quem deve ter acesso ao módulo Desempenho (hoje ninguém tem por padrão — é opt-in via checkbox).
5. Revisar/aprovar (ou rejeitar) as primeiras memórias organizacionais que os usuários sugerirem.
6. Fazer o teste manual clique a clique no navegador antes de considerar o rollout emocionalmente "fechado" — esta entrega validou tudo por teste automatizado, lint e build, mas não por uso real na tela.

## 9. Sugestões futuras priorizadas

1. **UI de consulta sobre `corp_ai_auditoria`/`corp_ai_feedback`** — os dados já são coletados desde a Fase 3/6, só falta uma tela para visualizá-los agregados.
2. **Modelar carteira por usuário `consulta`** — desbloqueia autorização por dado real na IA (hoje só por módulo) e granularidade real no Desempenho.
3. **Tools dedicadas** que o pedido original descreveu e ainda não têm equivalente 1:1 (`resumir_processo`, `obter_historico_processo`, `obter_historico_responsabilidade`, `sugerir_proxima_acao`) — priorizar `obter_historico_responsabilidade`, que já tem todo o dado pronto da Fase 2.
4. **`dados_estruturados` do envelope de resposta** (Fase 3) está vazio hoje — renderizar tabelas/números direto na UI do chat, não só texto.
5. Se a operação crescer além de ~15 usuários, reavaliar a introdução de uma peça mínima de backend (rate-limit e auditoria imutável do Gemini) — decisão que foi conscientemente adiada por causa do custo no porte atual.
