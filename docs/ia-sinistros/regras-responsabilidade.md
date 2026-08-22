# Histórico de Responsabilidade — Regras (Fase 2)

Status: implementado. Depende do diagnóstico em `docs/ia-sinistros/auditoria-inicial.md` (seção 8 — achado crítico, seção 12 — perguntas bloqueadoras 1, 2, 3 e 7, já respondidas abaixo).

## Decisões tomadas (respostas às perguntas bloqueadoras da auditoria)

| Pergunta | Decisão |
|---|---|
| Timezone oficial | `America/Sao_Paulo` (constante `TIMEZONE_OFICIAL` em `src/logic/responsabilidade.js`) — usada para exibição/agrupamento por dia; toda gravação de instante continua em UTC (`toISOString()`), como já era feito no resto do sistema |
| Definição de "responsável no dia" | **Responsável no momento da ação** — cada evento é resolvido pelo instante exato via `responsavelVigenteEm(historico, claimId, instanteISO)`, nunca por "predominante no dia" ou "proporção de horas" |
| Backfill de dados legados | Reconstrução parcial a partir do log de auditoria já existente (`overrides.audit[]`), sempre marcada como `origemAlteracao: "estimado_legado"` — nunca apresentada como fato. Ver `estimarHistoricoLegado()` |
| Backend mínimo (Cloud Functions) | **Recusado pelo usuário — sem custo de infraestrutura nova.** Toda a Fase 2 roda 100% no cliente, gravando na mesma coleção Firestore/localStorage já usada pelo resto do app (sem função serverless). Ver limitação de auditoria na seção "Risco aceito" abaixo |

## Modelo de dados

Nova chave em `RECORD_SPECS` (`src/data/schema.js`): `corp_responsabilidade_historico` (array, não-keyed — mesmo padrão de `corp_tasks`/`corp_notifs`). Aditiva: nenhuma chave existente foi removida ou renomeada.

```
{
  id: "rsp_xxxxx",
  claimId: string,                       // id do sinistro/atendimento (corp_claims.id)
  usuarioResponsavelId: string,          // corp_users.id
  inicioResponsabilidadeEm: string,      // ISO 8601 UTC
  fimResponsabilidadeEm: string | null,  // null = intervalo vigente
  motivoAlteracao: string,
  observacao: string,
  alteradoPorUsuarioId: string | null,   // quem executou a troca (null em dados legados estimados)
  origemAlteracao: "manual" | "importacao" | "integracao" | "regra_automatica" | "estimado_legado",
  createdAt: string,
  updatedAt: string,
}
```

Não existe "equipe"/"gestor"/"carteira" no modelo hoje (confirmado na auditoria) — por isso o modelo não tem esses campos ainda. Se a corretora confirmar que esses conceitos existem operacionalmente (pergunta 3 da auditoria, ainda em aberto), a estrutura pode ganhar `equipeId` de forma aditiva, sem quebrar o que já existe.

## Regras obrigatórias implementadas

1. **Sem intervalos sobrepostos** para o mesmo `claimId` — garantido por construção em `alterarResponsavel()` (sempre fecha o intervalo aberto antes de abrir outro) e verificável via `existeSobreposicao()`. Coberto por teste automatizado.
2. **Ao trocar o responsável**: o intervalo atual é encerrado com o horário efetivo da troca (`fimResponsabilidadeEm`), e um novo intervalo começa no mesmo instante para o novo responsável — sem lacuna nem sobreposição.
3. **Nada é apagado**: toda função de escrita usa `saveRecord(key, current => novoArray)` acrescentando/fechando, nunca removendo entradas.
4. **Backfill não sobrescreve**: a migração (`ResponsabilidadeBackfillCard.jsx`, em Configurações → só admin) ignora qualquer processo que já tenha pelo menos um intervalo — pode ser executada várias vezes sem duplicar.
5. **Timezone**: ver acima.
6. **"Responsável no dia"**: ver acima.
7. **Regra configurável e documentada**: as três decisões acima estão centralizadas neste documento e no comentário de topo de `src/logic/responsabilidade.js` — qualquer mudança futura de critério deve atualizar os dois lugares.

## Diferenciação de papéis (estado atual, sem invenção)

- **Responsável do processo**: `usuarioResponsavelId` vigente no histórico (e espelhado em `overrides.responsavelUser` por compatibilidade).
- **Usuário executor de uma ação de troca**: `alteradoPorUsuarioId` no próprio intervalo.
- **Criador do processo**: `claim.criadoPor` (só nome, sem id — limitação pré-existente de `Abertura.jsx`, fora do escopo desta fase).
- Não existem hoje: equipe responsável, supervisor/gestor, "responsável pelo atendimento" como conceito distinto de "responsável do processo" (no sistema, atendimento = sinistro com `partyType: "Aviso"`, mesma tabela).

## Integração com o código existente (compatibilidade retroativa)

`useOverrideActions().saveResponsavel(claimId, user, opts?)` agora faz duas gravações a cada chamada:
1. `corp_overrides[claimId].responsavelUser` — **mantido exatamente como antes**, porque dezenas de componentes (filtros de Sinistros, Dashboard, `ResponsavelBox`, tools de IA) leem esse valor de forma síncrona via `getResponsavel()`.
2. `corp_responsabilidade_historico` — novo, via `alterarResponsavel()`.

Nenhum dos dois pontos de chamada existentes (`DetailHeader.jsx`, `Abertura.jsx`) precisou mudar sua lógica — só `Abertura.jsx` ganhou um `motivo` mais descritivo no terceiro argumento (opcional).

## Interface

- **Embutido na aba "Auditoria Interna"** da tela de detalhe do sinistro — `components/detail/ResponsabilidadePanel.jsx` é renderizado dentro de `AuditPanel.jsx` (a pedido do usuário: as duas seções já existiam antes, então passaram a viver juntas na mesma aba em vez de abas separadas). Tabela com responsável, início, fim, duração, origem (com selo visual diferenciando "estimado" de dados reais) e motivo.
- **Card de migração** em Configurações (`components/config/ResponsabilidadeBackfillCard.jsx`, só admin) — botão único, idempotente, com resumo do resultado.

## Risco aceito (decisão do usuário)

Sem backend, **não há como impedir que o próprio código-cliente seja contornado** por alguém com acesso técnico ao navegador (ex.: chamar `saveRecord` diretamente pelo console, fora do fluxo de `saveResponsavel`). O histórico de responsabilidade é confiável para uso operacional normal da equipe através da interface, mas não é uma auditoria à prova de adulteração — isso exigiria uma peça de backend (Cloud Function ou regra de segurança do Firestore validando o formato/transição), que foi explicitamente descartada nesta fase por causa do custo.

## Rollback

Toda a Fase 2 é aditiva: uma nova chave (`corp_responsabilidade_historico`) e um novo campo opcional (`opts`) em uma função existente. Reverter:
1. Remover a chamada a `saveRecord("corp_responsabilidade_historico", ...)` dentro de `useOverrideActions.saveResponsavel` (volta ao comportamento anterior, só grava `responsavelUser`).
2. Nenhum dado existente precisa ser desfeito — `corp_overrides`, `corp_claims` e demais coleções não foram tocados.
3. A coleção `corp_responsabilidade_historico` pode ficar órfã sem causar erro (a UI só a lê se existir; ausência = array vazio, tratado por `EmptyState`).

## Como testar

1. `cd app && npm test` — 11 testes automatizados (`src/logic/responsabilidade.test.js`) cobrindo: abertura de primeiro intervalo, encerramento correto na transferência, ausência de sobreposição após múltiplas trocas, preservação do histórico antigo, idempotência, não atribuição de evento anterior ao início da responsabilidade, resolução por instante exato, filtragem/ordenação por processo, e os três cenários de backfill (com auditoria completa, só com valor atual, e sem nada a estimar).
2. `npm run build` — build de produção sem erros (já validado nesta implementação).
3. Manual (modo offline, `VITE_DATA_SOURCE=offline npm run dev`): abrir um sinistro, trocar o responsável na aba "Visão geral"/cabeçalho, abrir a nova aba "Histórico de Responsabilidade" e confirmar que o intervalo anterior aparece com "Fim" preenchido e o novo com selo "vigente". Depois, em Configurações (usuário admin), rodar a migração e confirmar que sinistros mockados com `responsavelUser` mas sem auditoria (`clm_001_S_9001`, `clm_002_T_9010`) ganham 1 intervalo marcado "Estimado (legado)".

> Nota desta entrega: os passos 1 e 2 foram executados e passaram. O passo 3 (clique a clique no navegador) não pôde ser executado nesta sessão porque as ferramentas de navegador (Claude in Chrome) não estavam habilitadas — recomenda-se essa validação manual antes de considerar a Fase 2 encerrada.
