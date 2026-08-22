# Catálogo de Filtros (Fase 4)

Fonte única de verdade: `app/src/ai/catalog/filtros.js` (também usada pela tool `listar_filtros_modulo`). Este documento é a versão legível para humanos do mesmo conteúdo — **mantidos em sincronia manualmente**, porque este projeto não tem schema formal nem introspecção automática possível (ver `auditoria-inicial.md`, seção D). Sempre que um filtro for adicionado/alterado numa tela, atualizar os dois lugares.

## Sinistros (`src/pages/Sinistros.jsx`)

| Campo | Rótulo | Tipo | Detalhe |
|---|---|---|---|
| `q` | Busca por texto | texto livre | segurado, placa, nº sinistro, nº apólice, seguradora, tipo, oficina, ramo (valores efetivos) |
| `tipo` | Tipo de parte | chip único | Todos, Segurado, Terceiro, Atendimento |
| `status` | Situação do processo | chip único | usa a situação **efetiva** (jornada do usuário), não o campo bruto da API CORP |
| `etapa` | Etapa da jornada | chip único dinâmico | gerado a partir de todos os templates de jornada configurados |
| `caminho` | Caminho (Perda Parcial/Integral) | chip único | Todos, Parcial, Integral |
| `ocoDe` / `ocoAte` | Data de ocorrência | intervalo de data | |
| `aviDe` / `aviAte` | Data de aviso | intervalo de data | |
| `pa` | Próxima ação até | data | |
| `atrasado` | Atrasados | booleano | próxima ação vencida |
| `semAtu` | Sem atualização | booleano | sem interação há mais de 3 dias corridos |
| `manual` | Criados manualmente | booleano | processos abertos via módulo Abertura |
| `aberto` | Em aberto | booleano | situação efetiva Pendente ou Em andamento |
| `responsavel` | Responsável | seleção | só considera processos Pendente/Em andamento |
| `sitatend` | Situação de atendimento | seleção configurável | `corp_sit_options` |
| `termometro` | Termômetro | seleção configurável | `corp_temp_options` |

Todos client-side, em memória (não persistem entre sessões). Sem filtros salvos, sem diferença por perfil.

## Dashboard (`src/pages/Dashboard.jsx`)

`ocoDe`/`ocoAte` (+ atalhos 7/30/90/180/365 dias, "Este ano", "Tudo"), `cia`, `ramo`, `oficina`, `tipo`, `status`, `caminho`, `manual`, `aberto`. Estado local da página; drill-down (clicar num gráfico) leva pra Sinistros com parte do filtro já aplicado.

## Desempenho (`src/pages/Desempenho.jsx`) — Fase 5

`periodoDe`/`periodoAte` (intervalo de data, padrão últimos 30 dias) e `usuarioId` implícito via botão "Ver sinistros" de cada linha (não é um filtro persistente, é uma ação de drill-down que abre Sinistros já filtrado por responsável).
