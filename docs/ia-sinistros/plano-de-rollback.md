# Plano de Rollback Consolidado

Princípio geral seguido em todas as fases: **nada é destrutivo**. Toda mudança de dado é uma nova chave/coleção aditiva; nenhuma coleção, campo ou regra existente foi removida, renomeada ou sobrescrita. Reverter qualquer fase é seguro porque os dados antigos nunca deixaram de ser gravados/lidos da forma original.

| Fase | O que reverter | Como | Efeito em dados existentes |
|---|---|---|---|
| 2 — Histórico de responsabilidade | Gravação em `corp_responsabilidade_historico` | Remover a chamada extra dentro de `useOverrideActions.saveResponsavel` (volta a só gravar `responsavelUser`) | Nenhum — `corp_overrides.responsavelUser` continua sendo a fonte usada pelo resto do app |
| 3 — Assistente evoluído | Autorização/envelope/auditoria no orquestrador | Reverter `useAiChatActions.js`/`responseEnvelope.js` para a versão anterior (módulo já existia antes desta fase) | Nenhum — `corp_ai_auditoria` fica órfã, sem erro (não é lida por nenhuma tela ainda) |
| 4 — Catálogo de filtros/dashboards | Tools `listar_filtros_modulo`/`explicar_dashboard` | Remover do array `TOOLS` em `src/ai/tools/index.js` | Nenhum — são tools de leitura, sem gravação |
| 5 — Desempenho | Módulo/rota/tool de desempenho | Remover a entrada `desempenho` de `MENU`/`MODULOS_DISPONIVEIS`/`PAGES`/`TOOLS` | Nenhum — o módulo só lê dados existentes |
| 6 — Memória/feedback | Coleções `corp_ai_memorias`/`corp_ai_feedback`, injeção no prompt | Remover a chamada a `useIaMemoria()` em `useAiChatActions.js` (prompt volta a não ter memórias) e/ou ocultar os componentes de UI novos | Nenhum — coleções ficam órfãs, sem erro |

## Rollback de emergência total do módulo de IA

Se necessário desligar TUDO relacionado a IA de uma vez, sem editar código: remover/invalidar `VITE_GEMINI_API_KEY` (secret do GitHub Actions e/ou `.env.local`) — `isGeminiConfigured()` já bloqueia a UI inteira do Assistente IA nesse caso (comportamento existente desde a primeira entrega, não mudou nesta rodada de fases).

## Rollback de dados legados (backfill da Fase 2)

Reverter especificamente a migração de histórico estimado: remover do array `corp_responsabilidade_historico` as entradas com `origemAlteracao: "estimado_legado"` (ou esvaziar a coleção inteira) — não afeta `corp_overrides`/`corp_claims`, que nunca foram tocados pela migração.
