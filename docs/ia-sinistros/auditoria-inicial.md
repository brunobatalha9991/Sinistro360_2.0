# Auditoria Inicial — IA Corporativa para o Sinistros 360

Data da auditoria: 2026-08-22
Repositório: `Sinistros 360 2.0` (branch `master`, commit `9a1be98` no momento desta auditoria)
Escopo: código-fonte do repositório (`app/`, `.github/workflows/`). Não inclui Firestore Security Rules nem configuração do Console do Firebase (não versionadas neste repositório — ver seção 9).

> **Aviso de método**: este documento descreve apenas o que foi encontrado por inspeção direta do código (arquivos, funções, dados mockados). Nenhuma tabela, endpoint, regra de negócio ou módulo foi presumido a partir do pedido original — onde a solicitação presume algo que não existe no código (ex.: ORM, migrations, filas, equipe/gestor, SLA formal), isso é sinalizado explicitamente como lacuna, não implementado silenciosamente.

---

## 1. Resumo executivo

O **Sinistros 360 2.0** é uma SPA (Single Page Application) em React 19 + Vite 8, **sem backend próprio** — todo o código roda no navegador do usuário e é publicado como arquivos estáticos no GitHub Pages. Não existe API própria, ORM, sistema de migrations, filas/jobs, cache de servidor ou testes automatizados.

Os dados vivem em uma de duas fontes intercambiáveis, escolhidas por variável de ambiente (`VITE_DATA_SOURCE`):
- **offline**: `localStorage` do navegador, semeado com dados fictícios (`mockData.js`) — usado por padrão, sem nenhuma chamada de rede;
- **firebase**: Cloud Firestore (NoSQL, documento por registro) — usado quando as credenciais `VITE_FIREBASE_*` estão configuradas.

A autenticação é própria (não usa Firebase Auth para login), com sessão em `sessionStorage`, 4 papéis fixos (`admin`, `analista`, `atendente`, `consulta`) e uma lista de módulos liberáveis por usuário.

Já existe uma integração com a API Gemini, implementada nesta mesma linha de trabalho (módulo "Assistente IA"): chamada REST direta do navegador (`fetch`, sem SDK), com function calling (4 ferramentas: 2 de leitura, 2 de escrita com fluxo de proposta + confirmação explícita antes de gravar), chave de API exposta no bundle do cliente (decisão consciente, sem proxy/backend).

**A lacuna mais crítica identificada** (seção 8) é que **não existe histórico de responsabilidade estruturado**: o campo "responsável" de um sinistro é um valor único que é sobrescrito a cada troca, sem registro de intervalo de vigência, e o log de auditoria que acompanha essa troca é parcial (nem todo ponto de escrita gera entrada auditável). Qualquer métrica de desempenho por usuário/período, como pedido nas seções 5 e 6 do escopo original, não pode ser calculada corretamente hoje sem essa estrutura.

Este documento cobre a auditoria completa pedida (arquitetura, módulos, dados, filtros, dashboards, responsabilidade, IA atual, lacunas, riscos) e fecha com o plano de fases e as perguntas de negócio que bloqueiam a Fase 2 antes de qualquer código ser escrito.

---

## 2. Diagrama textual da arquitetura atual

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Navegador do usuário                                                       │
│                                                                             │
│  React 19 SPA (Vite 8, roteamento por hash manual, sem SSR)               │
│  ├─ App.jsx — resolve rota via useHashRoute() + resolveAllowedRoute()      │
│  ├─ Shell.jsx — menu lateral (array MENU), filtrado por permissão          │
│  ├─ useAuth() ──> data/auth.js (sessão própria, sessionStorage,            │
│  │                  senha com PBKDF2-SHA256, ver logic/passwordHash.js)    │
│  ├─ DataProvider.jsx (Context) ── useData() ──> { records, config,        │
│  │        saveRecord, saveConfig }                                        │
│  │        │                                                                │
│  │        ├─ offlineAdapter.js ──> localStorage (mock data), sem rede     │
│  │        └─ firebaseAdapter.js ──> Firestore (onSnapshot, writeBatch)    │
│  │                                                                         │
│  ├─ Páginas (11 rotas, lazy-loaded — ver seção 3)                         │
│  │                                                                         │
│  ├─ Integração CORP (logic/corpApi.js)                                    │
│  │     fetch cru ──> API externa da seguradora/corretora ("API CORP")     │
│  │     login por token (localStorage), sincroniza corp_claims             │
│  │                                                                         │
│  └─ Módulo Assistente IA (pages/Assistente.jsx) — já implementado         │
│        ├─ hooks/useAiChatActions.js — orquestrador roda NO CLIENTE        │
│        ├─ ai/tools/* — 4 ferramentas (function calling)                   │
│        ├─ ai/geminiApi.js ── fetch direto ──> API Gemini                  │
│        └─ state/aiChat.js — histórico só em memória (perde ao recarregar) │
│                                                                             │
└───────────────────────────────────────────────────────────────────────────┘
         │                                    │                    │
         ▼                                    ▼                    ▼
┌─────────────────────┐   ┌──────────────────────────┐   ┌──────────────────┐
│ Cloud Firestore      │   │ API Gemini (Google)      │   │ API CORP          │
│ projeto              │   │ generativelanguage        │   │ (seguradora/      │
│ batalha-sinistro360  │   │ .googleapis.com           │   │  corretora)        │
│ 1 doc/registro,       │   │ chave client-side,        │   │ login por token,   │
│ sem schema formal,    │   │ sem proxy                 │   │ fora deste         │
│ sem migrations         │   │                           │   │ repositório        │
└─────────────────────┘   └──────────────────────────┘   └──────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│ CI/CD: .github/workflows/deploy.yml                                        │
│ push em master ──> build Vite (env vindo de GitHub Actions Secrets) ──>    │
│ upload-pages-artifact ──> deploy-pages (GitHub Pages)                     │
│ NÃO há etapa de testes automatizados no pipeline (nenhuma existe no repo) │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Módulos encontrados

Todos os módulos vivem em `app/src/pages/`, registrados em `src/pages/index.js` (lazy import) e no array `MENU` de `src/components/Shell.jsx`. Permissão por módulo é controlada por `MODULOS_DISPONIVEIS` em `src/data/auth.js`.

| Rota | Módulo | Arquivo principal | Observação |
|---|---|---|---|
| `dashboard` | Dashboard/BI | `pages/Dashboard.jsx` | KPIs, gráficos, drill-down (seção 7) |
| `sinistros` | Lista de Sinistros | `pages/Sinistros.jsx` | Filtros client-side (seção 6) |
| `sinistro` | Detalhe do Sinistro | `pages/Sinistro.jsx` + `components/detail/*` | Abas: Geral, Atendimento, Financeiro, Auditoria, Comunicação, Vínculos, Próxima Ação, Jornada |
| `abertura` | Abertura manual de processo | `pages/Abertura.jsx` | Cria sinistro fora da sincronização CORP |
| `demandas` | Nova Demanda | `pages/Demandas.jsx` | Vira tarefa após triagem |
| `tarefas` | Comunicação/Tarefas | `pages/Tarefas.jsx` | Tarefas + notificações internas |
| `clientes` | Clientes | `pages/Clientes.jsx` | Agrupamento simples por segurado |
| `seguradoras` / `oficinas` | Agregações | `pages/AggPage.jsx` | Componente reaproveitado para as duas rotas |
| `relatorios` | Relatórios | `pages/Relatorios.jsx` | Contagens simples por situação/seguradora |
| `integracao` | Integração CORP | `pages/Integracao.jsx` + `logic/corpApi.js` | Sincronização com a API externa da seguradora |
| `config` | Configurações | `pages/Configuracoes.jsx` + `components/config/*` | Templates de jornada, usuários, tipos de tarefa, importação de histórico |
| `assistente` | **Assistente IA** | `pages/Assistente.jsx` | Já implementado — ver seção 9 (Gemini) |

Não existem submenus — o menu lateral é uma lista plana de 12 itens (11 + Assistente IA).

---

## 4. Modelo de dados relevante

Não há schema relacional nem ORM. O "contrato de dados" vive em `src/data/schema.js` e é compartilhado pelos dois adapters (offline/Firebase):

```js
// CONFIG_KEYS — 1 documento inteiro por chave
["corp_cfg", "corp_task_types", "corp_form_endpoints", "corp_journey_templates",
 "corp_sit_options", "corp_temp_options", "corp_atendimento_template"]

// RECORD_SPECS — coleções (1 documento por registro no Firestore)
corp_claims:    { col: "s360_claims",    keyed: false }  // array de sinistros
corp_users:     { col: "s360_users",     keyed: false }  // array de usuários
corp_tasks:     { col: "s360_tasks",     keyed: false }  // array de tarefas
corp_notifs:    { col: "s360_notifs",    keyed: false }  // array de notificações
corp_demandas:  { col: "s360_demandas",  keyed: false }  // array de demandas
corp_overrides: { col: "s360_overrides", keyed: true }   // objeto {claimId: overrides}
```

### Sinistro (`corp_claims[i]`) — campos reais (via `mapCorp()` em `logic/corpApi.js` e `mockData.js`)
`id, codfil, nosnum, numsin, tipo (S/A/T), codigo, partyType (Segurado/Terceiro/Aviso), linkKey, segurado, cia, ramo, numapo, numend, item, placa, situacao (texto bruto da API CORP), franquia, valavi, valind, valdes, datoco, datavi, datenc, datvis, datlib, proxima_agenda, agendamento, responsavel (texto livre vindo da API), oficina, tipo_atendimento, descricao, observacoes, _raw`.
Processos criados manualmente (`Abertura.jsx`) têm `origem: "manual"` e não são sobrescritos pela sincronização.

**Não há campos de CPF/CNPJ, dados bancários, RG ou endereço no modelo mapeado hoje** — nem em `mapCorp()` nem em `mockData.js`. Se a API CORP real expõe esses campos, eles não estão sendo capturados atualmente pelo sistema (bom ponto de partida para LGPD, mas precisa confirmação — ver seção 12).

### Overrides (`corp_overrides[claimId]`) — dados editáveis pelo usuário, por cima do dado bruto do sinistro
```
sitAtend, temperatura, responsavelUser: {id, nome} | null,
nextAction: {title, date}, campos: {campo: valor} (edição de campo específico),
finance: {}, comms: [{canal, meio, date, text}], links: [claimId,...],
journeyUser: {caminho: "parcial"|"integral", steps: {stepId: {status, date, note, title}}},
journeyNotes, audit: [{id, at, who, role, acao, detalhe}]
```
`campoEfetivo(overrides, claim, campo)` decide: usa `overrides.campos[campo]` se existir e não vazio, senão o valor bruto do sinistro.

### Usuário (`corp_users[i]`)
`id, nome, email, senha (legado texto puro) | senhaHash+senhaSalt (PBKDF2-SHA256), role (admin|analista|atendente|consulta), modulos: [chave,...]` (opcional — ver observação de segurança na seção 9).

### Tarefa (`corp_tasks[i]`)
`id, tipo, titulo, origem (userId), destinatarios: [userId,...], descricao, anexo, obs, status (Pendente|Em andamento|Concluído), urgencia (Leve|Moderado|Urgente), processo (claimId opcional), createdAt, updatedAt, concludedAt, log: [{at, who, acao}], comments: [{id, userId, text, at}], ciente: {userId: isoDate}`.

### Notificação (`corp_notifs[i]`)
`id, taskId, userId, text, at, read`.

Não há entidade separada de "atendimento" distinta de "sinistro" — um atendimento é um sinistro com `partyType === "Aviso"` (`tipo === "A"` na API CORP), tratado pela mesma tabela `corp_claims` com um template de etapas diferente (`corp_atendimento_template`).

---

## 5. Mapa de fluxos de sinistro

1. **Ingestão**: `Integracao.jsx` chama `syncAll()` (`logic/corpApi.js`) — busca sinistros/terceiros/atendimentos (tipos S/A/T) da API CORP por período, mapeia via `mapCorp()`, funde com o array atual preservando os processos manuais (`isManualClaim`), e grava via `saveRecord("corp_claims", ...)`.
2. **Criação manual**: `Abertura.jsx` monta um sinistro com `origem: "manual"`, garante o template de jornada do ramo, opcionalmente define responsável inicial, grava um log de auditoria genérico ("Processo criado manualmente").
3. **Situação efetiva**: `situacaoEfetiva()` (`logic/claims.js`) prioriza o progresso da jornada registrada pelo usuário (`overrides.journeyUser`) sobre o campo bruto `situacao` vindo da API — só cai no valor bruto (`mapSituacao`) se a jornada nunca foi tocada.
4. **Etapa atual**: `currentStage()` percorre o template de jornada do ramo (etapas comuns → caminho parcial/integral) ou o template de atendimento (com suporte a "branches" por tipo), retornando o nome da primeira etapa não concluída.
5. **Encerramento**: não há uma função dedicada de "encerrar" — o processo é considerado "Indenizado" ou "Encerrado sem Indenização" quando a etapa "Conclusão" da jornada do usuário recebe esse status. **Não há regra de reabertura formal** (nenhuma função `reabrirProcesso` encontrada) — reabrir hoje significaria apenas editar a etapa de conclusão de volta.

---

## 6. Inventário de filtros

Todos os filtros são **100% client-side**, aplicados em memória sobre o array completo carregado (sem paginação real, sem consulta parcial). Não existem filtros salvos nem filtros por perfil — qualquer usuário com acesso ao módulo vê os mesmos filtros disponíveis.

### Sinistros (`pages/Sinistros.jsx`, estado em `state/listFilter.js`)
| Filtro | Tipo | Persistência |
|---|---|---|
| `q` (texto livre) | busca em segurado/placa/numsin/numapo/cia/tipo/oficina/ramo | em memória (store `listFilter`, reseta ao recarregar) |
| `tipo` | chip (Todos/Segurado/Terceiro/Atendimento) | idem |
| `status` | chip (situação efetiva) | idem |
| `etapa` | chip dinâmico (todas as etapas de todos os templates) | idem |
| `caminho` | chip (Todos/Parcial/Integral) | idem |
| `ocoDe`/`ocoAte`, `aviDe`/`aviAte` | intervalo de data | idem |
| `pa` (próxima ação até) | data | idem |
| `atrasado`, `semAtu`, `manual`, `aberto` | booleanos (chip toggle) | idem |
| `responsavel` | select (usuário ou "sem responsável") — **só aplica a processos Pendente/Em andamento** | idem |
| `sitatend` | select (situação de atendimento configurável) | idem |
| `termometro` | select (temperatura configurável) | idem |

Cada chip de contagem (`passa(c, except)`) recalcula quantos itens haveria se aquele filtro específico fosse aplicado a partir do recorte atual — não é um filtro "salvo", é uma contagem ao vivo.

### Dashboard (`pages/Dashboard.jsx`, estado local `dashFilter`, não compartilhado com a tela Sinistros exceto via drill-down)
`ocoDe/ocoAte` (+ atalhos 7/30/90/180/365 dias e "Este ano"), `cia`, `ramo`, `oficina`, `tipo`, `status`, `caminho`, `manual`, `aberto`.

O Dashboard tem uma função de "ir para Sinistros com este filtro" (`dashGoToSinistros`, em `state/listFilter.js`) usada em todo clique de gráfico/linha (drill-down) — mapeia parte dos filtros do dashboard para o filtro da lista.

**Gap em relação ao pedido**: o escopo original presume "filtros salvos", "filtros por perfil" e "filtros compostos" como recursos existentes a mapear — nenhum desses três existe hoje. Todo filtro é efêmero (memória) e igual para todos os perfis com acesso ao módulo.

---

## 7. Inventário de dashboards/KPIs

### `pages/Dashboard.jsx` — fonte: `records.corp_claims` + `corp_overrides`, filtrado por `dashFilteredClaims()`

| Card/Indicador | Fórmula | Fonte |
|---|---|---|
| Sinistros no recorte | `rows.length` | array filtrado |
| Em andamento / Indenizados / Sem indenização / Pendentes / Negados | contagem por `situacaoEfetiva(overrides, c).label` | `logic/claims.js` |
| Taxa de indenização | `indenizados / total * 100` | calculado |
| Atrasados | contagem de `isAtrasado()` = `nextAction.date < hoje` | `logic/claims.js` |
| Sem atualização | contagem de `isSemAtualizacao()` = sem `comms` OU último comm com data (`date` ou `at`) anterior a **3 dias corridos** (não úteis) atrás | `logic/claims.js` |
| Total avaliado/indenizado/franquias | soma de `valavi`/`valind`/`franquia` do recorte | soma direta |
| Ticket médio | `totalIndenizado / indenizados` | calculado |
| TMA (tempo médio de abertura) | média de `diasEntre(datoco, datavi)` | `logic/format.js diasEntre()` |
| TME (tempo médio de encerramento) | média de `diasEntre(datavi, datenc)` | idem |
| TMR (tempo médio de reparo) | média de `diasEntre(datavi, dataConclusaoEtapa)`, só caminho Parcial | idem |
| Distribuição por Situação/Tipo | `DonutChart`, clique faz drill-down (`goSinistros`) | agregação em memória |
| Funil por Etapa | `RankList`, contagem por `currentStage()` | idem |
| Evolução mensal (12m) | contagem de `datoco`/`datenc` por mês (`YYYY-MM`) | `last12Months()` |
| Temperatura / Situação de atendimento | `Legend`, contagem por `overrides.temperatura`/`overrides.sitAtend` | idem |
| Top 10 Oficinas/Seguradoras | `RankList`, `buildAggregation()` por chave (oficina/cia) | `logic/claims.js` |
| Desempenho por Oficina/Seguradora/Ramo | `PerfTable`, `buildAggregation()`: count, TMA, TME, TMR, valores, % atraso, taxa indenização | idem |
| Sinistros mais críticos | `rows.filter(isAtrasado)`, ordenado por data da próxima ação | idem |

`buildAggregation()` (`logic/claims.js`) é a função central de agregação — recebe uma `keyFn` e devolve `{count, valavi, valind, valdes, ticketMedio, tma, tme, tmr, atrasados, semAtu, indenizados, taxaIndeniz, pctAtraso}` por chave.

### `pages/Relatorios.jsx`
Apenas duas tabelas simples: contagem por situação efetiva e contagem por seguradora — sem gráficos, sem drill-down, sem filtro de período.

**Todo card tem fórmula rastreável no código** (nenhum "número mágico" foi encontrado) — isso favorece diretamente a ferramenta `explicar_dashboard` pedida na Fase 4, desde que o catálogo documente essas fórmulas fora do código também.

---

## 8. Regras atuais de responsabilidade — achado crítico

**Não existe histórico de responsabilidade.** O que existe:

- `corp_overrides[claimId].responsavelUser = {id, nome} | null` — **valor único, sobrescrito a cada troca**, sem data de início/fim de vigência.
- Dois pontos de escrita:
  1. `components/detail/DetailHeader.jsx` (`ResponsavelBox`) — ao trocar o responsável na tela do processo, chama `actions.saveResponsavel()` **e** `actions.logAudit(c.id, "Responsável definido", nome)`.
  2. `pages/Abertura.jsx` — ao criar um processo manual com responsável já definido, chama `actions.saveResponsavel()` **sem** uma entrada de auditoria específica (só existe o log genérico "Processo criado manualmente", que não menciona quem foi definido como responsável).
- O log de auditoria (`corp_overrides[claimId].audit[]`, gravado por `logAudit()` em `hooks/useOverrideActions.js`) é uma lista cronológica de eventos em **texto livre** (`{id, at, who, role, acao, detalhe}`), sem estrutura de "início/fim de intervalo" e sem cobertura garantida — cada função de gravação decide manualmente se chama `logAudit`, não há nenhum mecanismo central que garanta que toda mudança relevante seja registrada.

**Consequências diretas para o pedido original:**
- Não é possível hoje saber "quem era responsável por este processo em uma data específica no passado" com confiança — só reconstruir de forma aproximada, lendo o texto livre de auditoria (quando existe).
- Não existe conceito de **equipe**, **gestor** ou **carteira** em nenhum lugar do modelo de dados.
- Não existe distinção formal entre "responsável do processo" e "quem executou uma ação" — o audit log grava `who`/`role` do usuário da sessão no momento da ação, mas isso não é ligado à responsabilidade vigente.
- Não existe SLA formal por etapa/seguradora/tipo — o único conceito de prazo é o campo livre `nextAction.date` (a "próxima ação" definida manualmente por um usuário), usado tanto para "atrasado" quanto para ordenar a lista de críticos no Dashboard.
- "Sem atualização" usa **3 dias corridos** fixos no código (`isSemAtualizacao`, `logic/claims.js`), sem calendário de feriados, sem dias úteis, sem timezone configurável — a comparação usa `new Date()` do navegador do usuário.

Esta é a lacuna que bloqueia diretamente a Fase 2 (histórico de responsabilidade) e a Fase 5 (analytics de desempenho) do pedido original — nenhuma migração de dados legados pode ser feita com precisão total; o máximo possível é reconstruir parcialmente a partir do texto livre de auditoria existente, sinalizando a origem como "estimado/legado" (ver seção 11 e perguntas bloqueadoras na seção 12).

---

## 9. Integração Gemini atual (auditada nesta sessão)

Já implementada e publicada (commit `2dd11c0` em diante). Arquivos: `src/ai/geminiApi.js`, `src/ai/systemPrompt.js`, `src/ai/tools/*.js`, `src/state/aiChat.js`, `src/hooks/useAiChatActions.js`, `src/components/ai/ActionProposalCard.jsx`, `src/pages/Assistente.jsx`.

| Aspecto | Situação atual |
|---|---|
| Modelo | `gemini-3.6-flash` (configurável via `VITE_GEMINI_MODEL`, validado contra a API real) |
| Endpoint | REST direto (`generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`), sem SDK |
| Autenticação da API | Chave em `VITE_GEMINI_API_KEY`, **exposta no bundle do cliente** (decisão consciente, sem backend) |
| Function calling | Sim — 4 tools: `search_claims`, `report_claims_summary` (leitura), `create_task`, `update_claim_field` (escrita, com proposta + confirmação obrigatória) |
| Saída estruturada | Parcial — cada tool devolve um objeto JSON, mas **não há o envelope padronizado** `{tipo_resposta, fontes, metodologia, confianca, limitacoes,...}` pedido na seção 3.C do escopo original |
| RAG / embeddings / cache de resposta | Não existe |
| Memória entre sessões | Não existe — histórico de conversa vive só em `state/aiChat.js` (em memória do navegador), perdido ao recarregar a página |
| Autorização por ferramenta | **Parcial** — as tools leem `records`/`config` via o mesmo `useData()` que a UI usa, mas **nenhuma tool valida se o usuário logado tem permissão sobre o módulo/dado específico antes de responder** (ex.: hoje qualquer usuário com acesso ao módulo Assistente IA pode pedir para a IA buscar/relatar qualquer sinistro, mesmo que ele não tivesse acesso a esse dado navegando manualmente pelas telas — ver risco R1 na seção 10) |
| Auditoria/logs da IA | **Não existe** — nenhuma pergunta, resposta, tool call ou confirmação de ação é persistida; tudo fica só na memória do navegador da sessão atual |
| Proteção contra prompt injection via dados | **Não implementada** — comentários, observações e textos de sinistro entram no contexto (quando uma tool os retorna) como texto simples dentro do JSON de resposta da function; não há sanitização/instrução explícita de "trate isto como dado, não como comando" além da instrução genérica do `systemPrompt.js` |
| Custo/rate limit | Não há controle nenhum — qualquer usuário com acesso ao módulo pode gerar chamadas ilimitadas à API paga do Gemini |

---

## 10. Riscos técnicos

| # | Risco | Onde | Severidade |
|---|---|---|---|
| R1 | Tools da IA não replicam as regras de autorização de dado fino que possam existir fora do controle de módulo (`MODULOS_DISPONIVEIS`) — hoje o único controle é "o usuário pode ver o módulo Assistente IA", não "o usuário pode ver o sinistro X" | `src/ai/tools/*.js` | Alta (cresce com qualquer regra de segregação de carteira/equipe futura) |
| R2 | Chave da API Gemini exposta no cliente — abuso por terceiro que extraia a chave gera custo direto na conta Google, sem rate-limit no app | `src/ai/geminiApi.js`, bundle publicado | Média (decisão já aceita, mas sem mitigação de custo) |
| R3 | Nenhuma auditoria persistida das interações com a IA — impossível investigar "o que a IA respondeu para quem, quando, com base em quê" depois do fato | Módulo Assistente IA como um todo | Alta (bloqueia diretamente o requisito de auditoria da seção 8 do pedido original) |
| R4 | Firestore Security Rules não estão neste repositório — não é possível auditar via código se o controle de acesso a dados no modo `firebase` está de fato alinhado com os perfis do app | Fora do repo (Console Firebase) | Desconhecida — precisa investigação separada |
| R5 | Todas as telas (Sinistros, Dashboard, tools de IA) carregam o array completo de sinistros em memória — sem paginação real; funciona hoje pelo volume baixo dos dados mockados, mas não foi testado em escala | `DataProvider.jsx` e consumidores | Baixa agora, cresce com o volume real de produção |
| R6 | Nenhum teste automatizado no repositório (nenhum framework de teste instalado, nenhum arquivo `*.test.*`) — qualquer alteração em regra de negócio (`situacaoEfetiva`, `currentStage`, `isAtrasado`, cálculo de KPI) depende de validação manual | Repositório inteiro | Média-Alta para as fases seguintes (aumenta o risco de regressão silenciosa) |
| R7 | Auditoria de escrita é opcional por ponto de chamada (`logAudit` não é obrigatório) — já causou uma lacuna real (seção 8: criação manual não audita o responsável definido) | `hooks/useOverrideActions.js` e chamadores | Média |
| R8 | Sem timezone oficial configurável — todo cálculo de data usa o relógio/fuso do navegador do usuário, não um fuso de negócio único | `logic/format.js`, `logic/claims.js` | Média (afeta diretamente qualquer SLA/relatório entre fusos) |

---

## 11. Plano de implementação priorizado (adaptado à stack real)

O plano de 6 fases do pedido original presume um backend com ORM/migrations/filas que **não existe neste projeto**. Abaixo, o mesmo objetivo adaptado à realidade de uma SPA sem servidor sobre Firestore/localStorage — sem inventar infraestrutura que não será construída sem decisão explícita (ver seção 12, pergunta 5).

| Fase | Objetivo | Adaptação à stack real |
|---|---|---|
| **Fase 1 — Diagnóstico e fundação** (este documento) | Auditoria completa, plano por fases, perguntas bloqueadoras | Concluída nesta entrega |
| **Fase 2 — Histórico de responsabilidade** | Registrar intervalos de responsabilidade de forma confiável | Sem "migration" tradicional: nova chave em `RECORD_SPECS` (`schema.js`), ex. `corp_responsabilidade_historico` (array de intervalos), com leitura retrocompatível (processos sem histórico caem no `responsavelUser` atual, marcado como "sem histórico anterior"). Backfill parcial a partir do `audit[]` existente, marcado como "estimado". Sem downtime/rollback de banco (não há schema fixo a migrar) — reversão = parar de gravar na nova chave, dado antigo continua intacto |
| **Fase 3 — Assistente de consulta contextual (evolução)** | Orquestrador com autorização, evidências, saída estruturada | Evoluir o que já existe (`useAiChatActions.js` + tools) em vez de recriar: acrescentar envelope de resposta padronizado, checagem de autorização por dado (não só por módulo) dentro de cada tool, e um mecanismo de log (ver Fase 6/pergunta 5 sobre onde persistir esse log sem backend) |
| **Fase 4 — Catálogo de filtros e dashboards** | Documentar fórmulas/filtros existentes e uma tool `explicar_dashboard`/`listar_filtros_modulo` | Documentação viva (`docs/ia-sinistros/catalogo-*.md`, já esboçada nas seções 6 e 7 deste documento) + tools que leem essa documentação — não é "descoberta automática" via introspecção de schema (não existe schema formal a introspectar) |
| **Fase 5 — Analytics de desempenho** | Métricas por usuário/equipe/período, drill-down | Depende 100% da Fase 2 estar pronta e validada. Sem conceito de equipe/gestor hoje — precisa da decisão da pergunta 3 (seção 12) antes de desenhar filtros por equipe/gestor/carteira |
| **Fase 6 — Memória, feedback e melhoria contínua** | Feedback estruturado, memória pessoal/organizacional aprovada | Nova entidade de dados (`corp_ai_memorias`, `corp_ai_feedback`) seguindo o mesmo padrão de `RECORD_SPECS`; painel administrativo dentro de `Configuracoes.jsx` (só admin, seguindo o padrão já existente de seção condicionada por `isAdmin()`) |

Nenhuma fase além da 1 deve começar sem resposta às perguntas bloqueadoras da seção 12 — em especial as perguntas 1, 2, 3, 5 e 7, que mudam a forma como a Fase 2 é desenhada.

---

## 12. Perguntas de negócio que não puderem ser respondidas pelo código

1. **Timezone oficial**: o app hoje usa o fuso do navegador do usuário para toda comparação de data. Qual é o fuso oficial do negócio (presumo `America/Sao_Paulo`, mas preciso de confirmação) e ele deve ser fixo ou configurável por unidade/filial?
2. **Definição de "responsável no dia"**: das quatro opções do pedido original (responsável no início do dia / no momento da ação / predominante no dia / divisão proporcional por horas) — qual regra reflete como a corretora já pensa isso operacionalmente hoje?
3. **Equipe/gestor/carteira/filial**: nada disso existe no modelo de dados atual (só `role` individual). Esses conceitos existem na operação real da corretora? Se sim, preciso de uma lista real (nomes de equipes, hierarquia de gestores, definição de carteira) para desenhar o modelo — não vou inventar uma estrutura organizacional.
4. **SLA formal**: hoje "atrasado" = a data de `nextAction` (definida manualmente por um usuário) já passou. Existe um SLA contratual/política interna por etapa, seguradora ou tipo de sinistro que deveria substituir ou complementar essa regra?
5. **Apetite por uma peça de backend mínima**: sem nenhum servidor, alguns requisitos do pedido original — auditoria centralizada e imutável das interações da IA, controle de custo/rate-limit do Gemini, mascaramento seguro de dados sensíveis antes de chegar ao cliente — **não são tecnicamente possíveis apenas no navegador**. Existe abertura para introduzir uma Cloud Function (Firebase, já usado pelo projeto) só para essas responsabilidades, ou o projeto deve permanecer 100% frontend mesmo aceitando essas limitações?
6. **Confirmação do "banco de dados"**: confirma que a fonte de dados real de produção é o Firestore (`batalha-sinistro360`), sem plano de introduzir um banco relacional? Isso define como "migration reversível" deve ser interpretada daqui para frente (evolução de chave/schema em `schema.js`, não uma migration SQL).
7. **Backfill do histórico de responsabilidade**: aceito reconstruir parcialmente o histórico anterior a partir do `audit[]` de texto livre existente (impreciso, sinalizado como "estimado/legado"), ou o histórico estruturado deve começar zerado a partir da Fase 2, sem tentar reconstruir o passado?
8. **Escala real da operação**: quantos usuários/analistas ativos a corretora tem hoje? Isso define se a robustez completa pedida no Painel de Desempenho (seção 6 do pedido original) se paga agora ou se um MVP mais simples atende primeiro.
9. **Multi-tenant**: confirma que este é um sistema de uso interno de uma única corretora (não múltiplos clientes/corretoras na mesma instância)? Isso afeta diretamente o desenho de permissões e do catálogo funcional.
10. **Dados sensíveis (LGPD)**: a API CORP real (fora deste repositório) envia CPF/CNPJ, dados bancários ou outros dados pessoais sensíveis que hoje simplesmente não estão sendo mapeados por `mapCorp()`? Preciso confirmar isso com quem administra a integração CORP antes de desenhar qualquer regra de mascaramento.

---

## Anexo — resposta objetiva aos itens de auditoria pedidos (A–E)

**A. Stack**: JavaScript (React 19 + Vite 8, sem TypeScript no app hoje, embora `@types/react*` estejam instalados como devDependency). Sem back-end próprio. Sem ORM. Sem sistema de migrations. Autenticação própria (sessionStorage + PBKDF2-SHA256), sem OAuth/SSO. Autorização por `role` + lista de módulos (`data/auth.js`). Sem filas/jobs. Sem cache de servidor (Firestore tem cache local do SDK, não é uma camada de cache própria do app). Armazenamento de arquivos: não identificado (nenhum upload de anexo encontrado no código — campo `anexo` de tarefa é um link/texto livre, não upload real). Logs: `console.warn` local nos adapters, sem coletor centralizado. Monitoramento: nenhum (sem Sentry/analytics). Testes: nenhum framework instalado. Deploy: GitHub Actions → GitHub Pages (estático).

**B–C. Estrutura funcional / Sinistros e atendimentos**: cobertos nas seções 3–5 e 8.

**D. Filtros e dashboards**: cobertos nas seções 6–7.

**E. Gemini e IA atual**: coberto na seção 9.
