# Memória Controlada e Feedback (Fase 6)

Status: implementado.

## Por que memória não é criada automaticamente pela IA

O pedido original é explícito: "a IA não pode transformar automaticamente uma opinião isolada em regra corporativa". Por isso, `registrar_memoria` **não é uma tool que o Gemini pode chamar sozinho** — a única forma de criar uma memória é uma ação humana explícita na interface ("🎓 Ensinar o assistente", dentro do módulo Assistente IA). O modelo pode, no máximo, sugerir ao usuário que ensine algo; ele mesmo nunca decide gravar.

## Modelo de dados

Duas coleções novas, aditivas (`src/data/schema.js`):

### `corp_ai_memorias`
```
{ id, escopo: "pessoal"|"equipe"|"organizacional",
  usuarioId (só escopo pessoal), equipeGrupo: "gestor"|"equipe" (só escopo equipe),
  tipo, conteudo, fonte, confianca,
  status: "rascunho"|"pendente_aprovacao"|"aprovado"|"rejeitado"|"expirado",
  criadoPor, aprovadoPor, dataExpiracao, createdAt, updatedAt }
```

### `corp_ai_feedback`
```
{ id, respostaId (id da mensagem no chat), usuarioId,
  avaliacao: "util"|"nao_util"|"incorreta"|"faltou_informacao"|"muito_longa"|"muito_curta",
  comentario, correcaoSugerida, createdAt }
```

## Regras de escopo e aprovação (`src/logic/memoriaIA.js`, testado em `memoriaIA.test.js`)

- **Pessoal**: só usada nas conversas do próprio usuário que criou. **Autoaprovada** — não precisa de admin, porque não afeta mais ninguém.
- **Equipe**: mapeada para o `role` do usuário na hora da criação (`admin`/`atendente` → grupo "gestor", `analista`/`consulta` → grupo "equipe" — mesma decisão de negócio registrada em `auditoria-inicial.md`, pergunta 3). Só entra no prompt de usuários do mesmo grupo. **Nasce pendente de aprovação.**
- **Organizacional**: vale para todos os usuários. **Nasce pendente de aprovação.**
- Aprovação/rejeição/expiração só por admin (`isAdmin()`, mesma função usada em todo o resto do sistema) — painel em Configurações → "Memórias da IA".
- Memória expirada (`dataExpiracao` no passado) para de valer automaticamente, sem precisar ser apagada.
- Nenhuma memória é apagada por rejeição/expiração — só muda de `status` (histórico preservado).

## Como a memória chega até o Gemini

`useAiChatActions.js` busca as memórias ativas para o usuário logado (`memoriasAtivasParaUsuario`) e injeta no `systemPrompt.js` como uma lista de "conhecimento aprovado sobre esta operação" — explicitamente instruída a ser contexto, não fonte de dado de sinistro (dados de sinistro continuam vindo só das tools). Os IDs das memórias usadas em cada resposta são gravados em `corp_ai_auditoria.memoriasUsadasIds` — dá pra rastrear qual memória influenciou qual resposta.

## Feedback

Botões (👍 útil / 👎 não útil / ⚠ incorreta / 💬 comentário livre) aparecem sob toda resposta de texto do assistente. Sempre ação humana explícita, nunca inferida. Gravado em `corp_ai_feedback`, correlacionado com a mensagem (`respostaId`) e, transitivamente, com a entrada de auditoria daquela troca.

**Não implementado nesta fase**: um painel agregando/analisando o feedback recebido (ex.: "quantas respostas foram marcadas como incorretas este mês") — fica como sugestão futura; os dados já estão sendo coletados, só falta a visualização.

## Rollback

Aditivo: duas coleções novas, dois hooks novos, três componentes de UI novos. Nada existente foi alterado além da injeção opcional de memórias no prompt (que é `""` quando não há memória ativa — sem efeito colateral se a coleção estiver vazia). Reverter = remover a chamada a `useIaMemoria()` em `useAiChatActions.js` (volta ao prompt sem memórias) e/ou não exibir os componentes novos na UI; nenhum dado precisa ser desfeito.

## Como testar

1. `npm test` — cobre mapeamento de grupo, autoaprovação pessoal, pendência de equipe/organizacional, e visibilidade por escopo (incluindo expiração).
2. Manual: como usuário não-admin, criar uma memória "organizacional" via "Ensinar o assistente" → confirmar que ela aparece em Configurações → Memórias da IA como pendente (logado como admin) → aprovar → confirmar que uma nova pergunta relacionada já reflete esse conhecimento na resposta.
3. Dar feedback numa resposta e confirmar que o botão vira "Feedback registrado" e não pode ser enviado de novo pela mesma pessoa pra mesma resposta.
