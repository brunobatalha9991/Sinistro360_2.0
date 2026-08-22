# Mesa de Atendimento — Checklist, Solicitação e Upload de Anexos

Módulo dentro de **Comunicação Interna** (`Tarefas`). Não faz parte da iniciativa de IA (`docs/ia-sinistros/`) — é uma funcionalidade própria do fluxo operacional de abertura de sinistro.

## O que foi implementado

### 1. Tipo de tarefa "Mesa de Atendimento"
Novo valor em `corp_task_types` (editável em Comunicação → "+ Tipo", como qualquer outro tipo). Ao selecionar esse tipo no modal de tarefa, aparecem os recursos abaixo.

### 2. Seletor "Atendimento" (visual, chips)
Três opções, sempre visíveis em qualquer tarefa (não só Mesa de Atendimento): 🚗 **Sinistro**, 🛟 **Assistência 24h**, 🪟 **Assistência de vidros e pequenos reparos**. Salvo em `task.tipoAtendimento`. Aparece como badge no card da lista e é filtrável em Comunicação.

### 3. Checklist de abertura (`src/logic/checklistMesaAtendimento.js`)
Só marcação (não é formulário) — 12 itens do segurado + um toggle "Houve terceiro?" que revela mais 9 itens. Mostra progresso (`8/12`) no modal e no card da lista.

### 4. Formulário de Solicitação (`src/logic/solicitacaoAtendimento.js`)
Botão **"📋 Solicitação"** aparece assim que um tipo de atendimento é escolhido numa tarefa "Mesa de Atendimento". Abre o formulário de preenchimento correspondente — espelha os 3 formulários Google Forms internos já usados pela operação:

| Atendimento | Formulário espelhado | Campos |
|---|---|---|
| Sinistro | "ATENDIMENTO - SINISTROS (INTERNO)" | 32 campos, 3 seções (Seção "Dados do Terceiro" só aparece se o atendimento desejado não for "Apenas para o segurado") |
| Assistência 24h | "ATENDIMENTO - ASSISTÊNCIAS 24 HRS (INTERNO)" | 20 campos, 2 seções |
| Assistência de vidros | "ATENDIMENTO - ASSISTÊNCIA DE VIDROS E PEQUENOS REPAROS (INTERNO)" | 17 campos, 2 seções |

**Simplificação consciente**: os sub-agrupamentos condicionais mais finos dos formulários originais (ex.: "se precisa de transporte", "se for por agendamento", dentro da Seção 2 de Assistência 24h) foram mantidos como campos normais sempre visíveis, não escondidos por lógica condicional adicional — só a divisão Segurado/Terceiro do formulário de Sinistro tem condicional, porque é a mesma lógica que o checklist já usa. Replicar 100% da árvore de visibilidade de cada Google Form ficaria bem mais complexo sem ganho real, dado que o preenchimento aqui é sempre feito por um humano lendo os campos, não por um formulário linear de perguntas.

Dado salvo em `task.solicitacao = { campoId: valor, ... }`. Usuários **"consulta" já conseguem preencher isso hoje** — a criação/edição de tarefas nunca foi restrita por perfil neste sistema (confirmado no código: `TaskModal.jsx` não tem nenhuma checagem de `canEdit`/role).

### 5. Upload de anexos para o Google Drive — sem login do usuário

Campos tipo "arquivo" (CNH, CRLV, fotos, boletim de ocorrência, proposta assinada) fazem upload real para uma pasta do Google Drive, através de um **Google Apps Script publicado como Web App** — o mesmo tipo de integração que este sistema já usa em Comunicação → Demandas (`config.corp_form_endpoints`, `src/logic/demandaSync.js`), só que para enviar em vez de ler.

**Organização das pastas** (a pedido do usuário — nada de anexo solto misturado): dentro da pasta raiz, os arquivos são organizados automaticamente em `Tipo de Atendimento / Data + Nome do Segurado`, por exemplo:

```
Pasta raiz
├── Sinistro
│   ├── 2026-08-22_Carlos Andrade_a1b2c3d4
│   │   ├── cnh_condutor.jpg
│   │   └── boletim_ocorrencia.pdf
│   └── 2026-08-23_Fernanda Lima_9f8e7d6c
├── Assistencia 24h
│   └── 2026-08-22_Ricardo Souza_5a4b3c2d
└── Assistencia Vidros e Pequenos Reparos
```

O sufixo aleatório no final do nome da subpasta evita que duas solicitações do mesmo segurado no mesmo dia se misturem. Se o nome do segurado for preenchido só depois do primeiro anexo já enviado, esse(s) primeiro(s) ficam na subpasta anterior ("Sem nome") — os anexos seguintes já vão para a subpasta certa (limitação aceitável: preencher o nome do segurado antes de anexar evita isso).

### 6. Anexos gerais do processo (proposta de seguro, dados do segurado, etc.)

Nova aba **"Anexos"** na tela de detalhe de cada sinistro (`components/detail/AnexosPanel.jsx`) — upload livre (não estruturado como o formulário de Solicitação), com uma descrição opcional por arquivo. Guardado em `corp_overrides[claimId].anexos` (mesmo padrão de `comms`/`audit`/`campos` já usado nesse registro). Toda adição/remoção também gera uma entrada na Auditoria Interna do processo.

**Pasta separada da Mesa de Atendimento**, a pedido do usuário — usa o mesmo Apps Script e a mesma URL configurada em Configurações, mas uma **pasta-raiz diferente no Drive**, selecionada pelo campo `contexto` que o app já envia sozinho (`"mesa_atendimento"` vs. `"processo"` — ver `logic/driveUpload.js`, constantes `CONTEXTO_MESA_ATENDIMENTO`/`CONTEXTO_ANEXOS_PROCESSO`). Dentro dela, uma subpasta por processo (`{número do sinistro}_{segurado}`). Essa é a solução recomendada em vez de publicar um segundo Apps Script: menos passos de configuração pra você, e as pastas ficam igualmente separadas no Drive.

Requer uma **segunda pasta-raiz no Drive** (só pra anexos de processo) — crie uma pasta, copie o ID e me avise; o código do Passo 2 abaixo já tem um espaço reservado pra esse segundo ID.

Por que não dá pra ser mais simples: subir arquivo pro Drive exige alguma credencial Google. Colocar uma chave de conta de serviço (service account) direto no código do site seria um risco grave — qualquer pessoa que abrisse o navegador poderia extrair essa chave e teria acesso total ao Drive de vocês. A solução usada aqui resolve isso: o Apps Script roda **com a permissão de quem publicou o script** (a conta de vocês), e o navegador do usuário `consulta` só faz um `POST` comum pra uma URL pública — nenhum login Google, nenhuma credencial exposta no código do site.

## Configuração necessária (só você pode fazer — precisa da sua conta Google)

### Passo 1 — Pastas no Drive (são DUAS)
1. **Mesa de Atendimento**: `1cpghJhUCYl-00sRm8mLCV-NFa4744p8U`.
2. **Anexos de processo**: `1O7LhB_N7QadA-5k-qmts90EqmCykSEKy`.

Os dois IDs já estão preenchidos no código abaixo — não precisa trocar nada.

> Nota: eu não consegui abrir a primeira pasta pelas minhas ferramentas de Drive ("Requested entity was not found") — o mais provável é que a conta Google conectada às minhas ferramentas nesta sessão seja diferente da conta que vai publicar o Apps Script (o que é normal e não impede nada). Só confirme, ao publicar o script no Passo 2, que os IDs são mesmo das pastas certas — se algum estiver errado, o primeiro upload daquele contexto vai falhar com um erro claro ("pasta não encontrada").

### Passo 2 — Publicar o Apps Script
1. Acesse **script.google.com** (logado na conta Google dona da pasta) → **Novo projeto**.
2. Apague o conteúdo padrão e cole o código abaixo (já com os dois IDs preenchidos).
3. Se quiser trocar alguma das pastas depois, edite `PASTA_RAIZ_MESA_ATENDIMENTO_ID`/`PASTA_RAIZ_ANEXOS_PROCESSO_ID`.

```javascript
const PASTA_RAIZ_MESA_ATENDIMENTO_ID = "1cpghJhUCYl-00sRm8mLCV-NFa4744p8U";
const PASTA_RAIZ_ANEXOS_PROCESSO_ID = "1O7LhB_N7QadA-5k-qmts90EqmCykSEKy";

function obterOuCriarCaminho(pastaRaiz, caminho) {
  let atual = pastaRaiz;
  String(caminho || "").split("/").forEach(function (nome) {
    nome = nome.trim();
    if (!nome) return;
    const existentes = atual.getFoldersByName(nome);
    atual = existentes.hasNext() ? existentes.next() : atual.createFolder(nome);
  });
  return atual;
}

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const pastaRaizId = dados.contexto === "processo" ? PASTA_RAIZ_ANEXOS_PROCESSO_ID : PASTA_RAIZ_MESA_ATENDIMENTO_ID;
    const pastaRaiz = DriveApp.getFolderById(pastaRaizId);
    const pastaDestino = dados.pasta ? obterOuCriarCaminho(pastaRaiz, dados.pasta) : pastaRaiz;

    const bytes = Utilities.base64Decode(dados.conteudoBase64);
    const blob = Utilities.newBlob(bytes, dados.tipoArquivo || "application/octet-stream", dados.nomeArquivo || "arquivo");
    const arquivo = pastaDestino.createFile(blob);
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ContentService.createTextOutput(JSON.stringify({
      id: arquivo.getId(),
      url: arquivo.getUrl(),
      nome: arquivo.getName(),
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ erro: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Salve o projeto (Ctrl+S), dê um nome (ex. "Upload Mesa de Atendimento").
5. **Implantar → Nova implantação**. Em "Tipo", escolha **App da Web**.
6. "Executar como": **Eu** (sua conta). "Quem pode acessar": **Qualquer pessoa**.
7. Clique em **Implantar** → na primeira vez, o Google vai pedir para autorizar o script a acessar seu Drive (é normal — é a SUA autorização, não a de quem vai usar o formulário).
8. Copie a **URL do app da Web** (termina em `/exec`).

### Passo 3 — Configurar no sistema
No Sinistros 360, vá em **Configurações → Upload de Anexos (Google Drive)**, cole a URL do Passo 2 e clique em Salvar. O status muda para "Configurado" e os campos de arquivo do formulário de Solicitação passam a funcionar.

**Se editar o código do Apps Script depois**: é preciso criar uma **nova versão de implantação** (Implantar → Gerenciar implantações → editar → Nova versão) para a mudança valer — só salvar o script não atualiza a URL já publicada.

## Como testar

1. `npm test` — 32 testes automatizados cobrem a validação dos 3 formulários (campos obrigatórios, seção condicional de terceiro no Sinistro) e a checagem de configuração do upload.
2. Manual: em Comunicação, criar uma tarefa "Mesa de Atendimento", escolher um dos 3 atendimentos, clicar em "📋 Solicitação", preencher e enviar um arquivo pequeno num campo de upload — confirmar que aparece o link "📎 nome ↗" e que ele abre o arquivo no Drive, com acesso "qualquer pessoa com o link" (teste em uma aba anônima, sem estar logado no Google, para confirmar que realmente não pede login).
3. Confirmar que sem a URL configurada em Configurações, os campos de arquivo mostram o aviso "Configure o upload..." em vez de tentar enviar.
4. Manual: abrir um sinistro, aba "Anexos", enviar um arquivo com uma descrição — confirmar que ele aparece na lista com link funcional, e que uma entrada aparece na aba "Auditoria Interna" do mesmo processo. Confirmar no Drive que esse arquivo caiu na pasta-raiz de **Anexos de processo**, não na de Mesa de Atendimento.
