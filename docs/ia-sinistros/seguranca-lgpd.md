# Segurança e LGPD

Status: implementado o que é possível sem backend (decisão do usuário, seção 5 da auditoria). Este documento consolida o que já existia, o que foi adicionado nas Fases 2–6, e o que continua em aberto.

## Autorização

- Reutiliza integralmente a política de permissões existente (`role` + `MODULOS_DISPONIVEIS`, `src/data/auth.js`) — nenhuma trilha de permissão nova foi inventada.
- **Ações de escrita da IA exigem `canEdit(currentUser)`** (Fase 3) — a mesma regra que a interface humana já aplicava, agora também no orquestrador (`useAiChatActions.js`). Um usuário `consulta` não consegue mais fazer a IA criar/editar nada, mesmo pedindo.
- **Limitação conhecida e aceita**: não existe autorização por dado (por sinistro/carteira específica) em NENHUM lugar do sistema hoje, incluindo a IA — porque essa granularidade não existe no app original. A IA nunca acessa mais do que qualquer usuário logado já acessaria manualmente pelas telas.
- "Administradores não recebem acesso implícito que contrarie regras de segregação" — não há hoje regra de segregação além de módulo/role, então não há nada a violar; quando a carteira por usuário `consulta` for modelada (pendência da auditoria), este ponto precisa ser revisitado.

## Minimização de dados enviados à IA

- Nenhuma tool envia o array completo de sinistros — todas paginam/limitam (`search_claims`: máx. 20; `report_claims_summary`: só agregados, nunca lista bruta).
- **CPF/CNPJ, dados bancários, RG, endereço**: confirmado na auditoria que **não são mapeados hoje** por `mapCorp()` nem existem em `mockData.js` — não há o que mascarar porque o dado simplesmente não chega ao sistema. **Pendência real**: confirmar com quem administra a integração CORP se a API real envia algo assim que não esteja sendo capturado (pergunta 10 da auditoria, ainda em aberto).
- Anexos/documentos completos: não existe upload real de arquivo no sistema (campo `anexo` de tarefa é link/texto livre) — nada a limitar aqui.

## Auditoria

- `corp_ai_auditoria` (Fase 3): usuário, data/hora, pergunta, ferramentas chamadas, fontes acessadas, se foi bloqueado por permissão, confiança da resposta, se pausou para confirmação, erros.
- `corp_ai_feedback` (Fase 6): avaliações e comentários do usuário sobre cada resposta, correlacionáveis com a auditoria via `respostaId`.
- **Limitação aceita explicitamente pelo usuário** (decisão registrada em `regras-responsabilidade.md`): sem backend, nada disso é à prova de adulteração via console do navegador. Suficiente para operação normal, não para investigação forense.

## Proteção contra instrução maliciosa

- `systemPrompt.js` instrui o modelo a tratar todo texto vindo de resultado de ferramenta (comentários, observações, descrições) como dado, nunca como instrução — e a nunca revelar a própria instrução de sistema, chaves ou detalhes internos.
- Mitigação por instrução ao modelo, não por filtro técnico — não há sanitização de conteúdo separada. Aceitável dado o porte da operação (até 5 usuários internos, não é uma superfície pública).

## Ações sensíveis

- IA em modo consulta/sugestão para tudo que não seja explicitamente uma das duas tools de escrita (`create_task`, `update_claim_field`).
- Toda ação de escrita mostra resumo, dados afetados, e exige confirmação explícita antes de gravar (`ActionProposalCard.jsx`) — nunca grava sozinha.
- Quem confirmou fica registrado (auditoria + `alteradoPorUsuarioId` no histórico de responsabilidade, quando aplicável).

## Pendências reais (não resolvidas nesta entrega, exigem decisão/validação de quem administra a corretora)

1. Confirmação sobre CPF/CNPJ/dados bancários na API CORP real (pergunta 10 da auditoria).
2. Firestore Security Rules — fora deste repositório, não auditadas por código (risco R4 da auditoria).
3. Carteira por usuário `consulta` não modelada — quando resolvida, revisitar autorização por dado nas tools de leitura.
