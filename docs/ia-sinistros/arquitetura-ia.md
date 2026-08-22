# Arquitetura da IA — Assistente Sinistros 360 (Fase 3)

Status: implementado. Evolui o módulo Assistente IA já existente (auditado em `auditoria-inicial.md`, seção 9) em vez de recriá-lo.

## Por que não há um "orquestrador" separado como serviço

O pedido original descreve um orquestrador como uma camada de backend (recebe pergunta, valida usuário/servidor, chama o modelo, valida resposta). **Este projeto não tem servidor** (decisão confirmada na auditoria, mantida por causa do custo). O papel de orquestrador é desempenhado por `src/hooks/useAiChatActions.js`, rodando no cliente — é o único ponto por onde toda pergunta, chamada de tool e resposta passam, então é ali que autorização, evidências e auditoria são aplicadas. Isso não é tão forte quanto um servidor (ver "Risco aceito" abaixo), mas é o máximo possível dentro da restrição de não introduzir backend.

## 1. Autorização por ação (não só por módulo)

Antes desta fase, qualquer usuário com acesso ao módulo "Assistente IA" podia pedir para a IA criar tarefas ou editar sinistros, mesmo que seu perfil fosse `consulta` (que na interface humana é bloqueado com o alerta "Seu perfil é apenas de consulta").

Agora, `useAiChatActions.js` verifica `canEdit(currentUser)` — a **mesma função** já usada em `ResponsavelBox` e `TaskModal.jsx` — antes de executar qualquer tool com `requiresConfirmation: true`. Se o perfil não permite, a tool nem chega a rodar: o Gemini recebe um `functionResponse` de erro e deve informar o usuário, sem propor a ação.

Isso não é "autorização por dado" (por sinistro/carteira específica) porque **essa granularidade não existe hoje em nenhum lugar do sistema** (confirmado na auditoria — nenhuma tela humana filtra sinistros por carteira ainda). Quando a lacuna de "carteira por usuário consulta" for resolvida (pendência registrada em `auditoria-inicial.md`), as tools de leitura devem ganhar o mesmo filtro que a tela humana ganhar — não antes, para não inventar uma regra que não existe no resto do sistema.

## 2. Envelope de resposta estruturado

Cada resposta de texto do modelo agora carrega um objeto `envelope` (`src/ai/responseEnvelope.js`), **construído pelo orquestrador a partir do que as tools realmente devolveram nesta troca** — nunca a partir do que o modelo "diz" que fez:

```js
{
  tipo_resposta: "analise" | "lista" | "resposta",
  titulo, resposta,
  dados_estruturados: {},          // reservado para uso futuro (ver limitação abaixo)
  fontes: [{ tipo, id, descricao, data_hora, url_interna }],
  filtros_aplicados: {},           // args reais passados às tools nesta troca
  periodo_analisado: { inicio: null, fim: null, timezone: "America/Sao_Paulo" },
  metodologia: "",                 // texto fixo que cada tool já devolve (não gerado pelo modelo)
  confianca: "alta" | "baixa",     // "alta" só se pelo menos 1 fonte real foi usada
  limitacoes: [],                  // ex.: alerta automático quando nenhuma tool foi chamada
  requer_confirmacao: false,
}
```

Regras de preenchimento (deterministas, em `buildEnvelope()`):
- `fontes` vem de `outcome.fontes` que cada tool de leitura devolve (`search_claims`, `report_claims_summary`), com link interno (`#/sinistro/<id>`) navegável direto pelo roteador hash do app.
- `confianca` é `"baixa"` sempre que a resposta de texto não usou nenhuma tool nesta troca — sinal automático de que a resposta pode não estar baseada em dado real do sistema.
- `periodo_analisado.timezone` reaproveita a constante oficial decidida na Fase 2 (`TIMEZONE_OFICIAL`, `America/Sao_Paulo`).
- `tipo_resposta` é reduzido a 3 categorias reais (`analise`, `lista`, `resposta`) — as demais do pedido original (`resumo_processo`, `explicacao_dashboard`, `alerta`, `indisponivel`) não têm tool correspondente ainda; adicioná-las nas Fases 4 (dashboards) e futuras vai estender este mapa, não recriá-lo.

**Limitação conhecida**: `dados_estruturados` fica vazio nesta entrega — as tools já devolvem dados estruturados (`resultados`, `grupos`), mas a UI ainda não os renderiza de forma tabular fora do texto do modelo. Fica registrado como próximo passo de UX, não bloqueia o restante.

## 3. Auditoria das interações

Nova coleção `corp_ai_auditoria` (aditiva, mesmo padrão de `RECORD_SPECS`), gravada ao final de cada ciclo do orquestrador (resposta final, pausa por confirmação, erro, ou "ciclo longo sem conclusão"):

```
{ id, at, usuarioId, usuarioNome, pergunta, ferramentasChamadas: [{nome, args}],
  fontesIds: [...], bloqueadoPorPermissao: boolean, tipoResposta?, confianca?,
  requerConfirmacao?, erro? }
```

Confirmação/cancelamento de uma proposta gera **outra** entrada de auditoria (rotulada `[confirmação de ação: ...]`/`[cancelamento de ação: ...]`), preservando o rastro de quem confirmou e quando.

### Risco aceito (decisão do usuário, já registrada em `regras-responsabilidade.md`)

Sem backend, esta auditoria **não é à prova de adulteração** — um usuário com acesso técnico ao console do navegador poderia, em tese, gravar diretamente em `corp_ai_auditoria` ou pular o orquestrador. É suficiente para uso operacional normal e dá visibilidade centralizada (ao contrário do estado anterior, em que nada era persistido), mas não é uma auditoria de segurança forte. Isso só mudaria com uma peça de backend, que foi explicitamente recusada por causa do custo.

**Ainda não implementado nesta fase**: uma tela de administração para visualizar `corp_ai_auditoria` (a coleção existe e é gravada, mas não há UI de consulta ainda) — fica para a Fase 6 (memória/feedback/painel administrativo), onde faz mais sentido ficar ao lado do painel de aprovação de memórias.

## 4. Proteção contra instruções maliciosas em dados

`systemPrompt.js` agora instrui explicitamente o modelo a tratar qualquer texto vindo de resultado de ferramenta (comentários, observações, descrições) como **dado**, nunca como instrução a seguir, e a nunca revelar a própria instrução de sistema, chaves ou detalhes internos. Isso é uma mitigação por instrução (não uma barreira técnica) — o modelo pode, em tese, ainda ser induzido; não há um filtro de conteúdo separado nesta fase.

## Arquivos alterados/criados nesta fase

- `src/ai/responseEnvelope.js` (novo) — `buildEnvelope()`
- `src/ai/tools/searchClaims.js`, `src/ai/tools/reportClaims.js` — passam a devolver `fontes`/`metodologia`
- `src/ai/systemPrompt.js` — regras de autorização/anti-injeção adicionadas
- `src/hooks/useAiChatActions.js` — autorização por ação, montagem do envelope, auditoria
- `src/state/aiChat.js` — comentário de shape atualizado (mensagem de texto ganha `envelope`)
- `src/pages/Assistente.jsx`, `src/styles/global.css` — exibição de fontes/confiança/limitações no chat
- `src/data/schema.js`, `src/data/mockData.js`, `src/data/offlineAdapter.js` — nova coleção `corp_ai_auditoria`

## Como testar

1. `npm test && npm run build` (já validado nesta entrega).
2. Manual (modo offline): perguntar "quantos sinistros em andamento por seguradora?" — a resposta deve vir com selo "Confiança alta", metodologia visível, e um link de fonte pra `#/relatorios`.
3. Perguntar algo genérico sem relação a dados (ex.: "o que você pode fazer?") — deve vir com selo "Confiança baixa" e o aviso de limitação.
4. Logar como usuário `consulta` (ou marcar esse role num usuário de teste), pedir para a IA criar uma tarefa — a proposta **não deve aparecer**; a resposta deve explicar que o perfil não permite a ação.
5. Depois de qualquer uma das interações acima, verificar em `records.corp_ai_auditoria` (ex. via DevTools, `localStorage.getItem("corp_ai_auditoria")` em modo offline) que uma entrada foi gravada com a pergunta, ferramentas chamadas e resultado.

> Nota: os passos 2–5 não puderam ser executados nesta sessão por falta de ferramentas de navegador habilitadas (mesma limitação já registrada na Fase 2) — recomenda-se essa validação manual.
