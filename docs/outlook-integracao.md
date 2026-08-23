# Integração com Outlook — configuração necessária (Azure AD)

Este guia é o pré-requisito único e obrigatório para o módulo "E-mails" (leitura da
caixa de entrada do Outlook dentro do Sinistro360). Sem isso, não tem como o
sistema logar na sua conta Microsoft com segurança — é a mesma ideia do que já
foi feito pro Firebase e pro Gemini: um cadastro gratuito, feito uma única vez.

Ninguém além de você (ou de quem fizer esse cadastro) vê a senha da sua conta
Microsoft em momento nenhum — o login acontece direto na tela oficial da
Microsoft (login.microsoftonline.com), e o Sinistro360 só recebe de volta um
token de acesso temporário, com permissão só de **leitura** de e-mail
("Mail.Read").

## Passo a passo

1. Acesse **https://portal.azure.com** e faça login com a conta Microsoft/Outlook
   que você quer conectar (a mesma cuja caixa de entrada será lida).

2. Na busca do topo, digite **"Registros de aplicativo"** (ou "App registrations")
   e abra essa tela.

3. Clique em **"+ Novo registro"**.

4. Preencha:
   - **Nome**: `Sinistro360 - Outlook` (ou o nome que preferir, é só um rótulo).
   - **Tipos de conta com suporte**: escolha
     **"Contas em qualquer diretório organizacional e contas pessoais da Microsoft"**
     (a opção mais ampla — funciona tanto se seu e-mail for uma conta corporativa
     do Microsoft 365 quanto uma conta pessoal @outlook.com/@hotmail.com).
   - **URI de Redirecionamento**:
     - Tipo: **"SPA (Single-page application)"**
     - Valor: `https://brunobatalha9991.github.io/Sinistro360_2.0/`

5. Clique em **"Registrar"**.

6. Na página do app recém-criado (tela "Visão geral"), copie e me envie:
   - **ID do aplicativo (cliente)** — é o dado principal que preciso.
   - **ID do diretório (locatário)** — só é necessário se você escolher restringir
     o acesso só à sua organização depois; com a opção do passo 4 (mais ampla),
     não preciso desse valor.

7. No menu lateral desse mesmo app, vá em **"Permissões de API"**.
   - Clique em **"+ Adicionar uma permissão"** → **"Microsoft Graph"** →
     **"Permissões delegadas"**.
   - Busque **"Mail"** e marque **"Mail.Read"**.
   - Clique em **"Adicionar permissões"**.
   - Se aparecer o botão **"Conceder consentimento de administrador"** e você for
     admin do Microsoft 365 da empresa, clique nele (evita uma tela extra de
     permissão no primeiro login). Se não aparecer ou você não for admin, sem
     problema — a permissão será pedida direto pra você no primeiro login.

8. **Não precisa criar nenhum "segredo do cliente" (client secret)** — como o
   app é do tipo SPA, o login usa um fluxo (PKCE) que não exige senha nenhuma
   guardada no sistema.

## O que fazer com o Client ID depois

Assim que eu tiver o **ID do aplicativo (cliente)**, eu configuro isso dentro de
Configurações (mesmo padrão do CORP/Drive) e sigo com a implementação do módulo:
caixa de entrada, identificação automática de nº de sinistro/placa/nome no
e-mail, alerta dentro de cada processo (sem gravar nada sozinho), vínculo manual
pra e-mails não identificados, e o botão de "transformar em atualização" que leva
pro Histórico do processo já com o conteúdo do e-mail preenchido pra você revisar
antes de salvar.
