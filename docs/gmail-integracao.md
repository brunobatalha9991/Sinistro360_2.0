# Integração com Gmail — configuração necessária (Google Cloud Console)

Alternativa ao Outlook (`docs/outlook-integracao.md`), pra quando a conta
Microsoft 365 estiver travada esperando aprovação de administrador: uma
conta **pessoal @gmail.com** não tem "administrador de organização" nenhum
no meio — o consentimento é sempre feito direto por quem é dono da conta,
na hora. Se você usar uma conta Google de uma organização (Google
Workspace), o mesmo tipo de bloqueio de admin pode acontecer — pra evitar
isso de novo, use uma conta Gmail pessoal (@gmail.com) mesmo.

Assim como no Outlook, ninguém vê sua senha do Google em momento nenhum —
o login acontece na tela oficial do Google, e o Sinistro360 só recebe de
volta um token temporário. Hoje o sistema pede três permissões: ler e-mail
(`gmail.readonly`), mover/organizar e-mail em pastas (`gmail.modify`) e
enviar e-mail (`gmail.send`) — essa última só é usada quando você clica em
"Enviar" no botão "Responder" dentro do sistema, nunca automaticamente.

## Passo a passo

1. Acesse **https://console.cloud.google.com/** e faça login com a conta
   Google que vai gerenciar essa integração (pode ser a mesma conta que
   você vai conectar depois, ou outra).

2. Se ainda não tiver um projeto, crie um (botão de projetos no topo →
   "Novo projeto"). Pode chamar de `Sinistro360`.

3. No menu lateral (☰), vá em **"APIs e serviços" → "Tela de consentimento OAuth"**.
   - Tipo de usuário: **"Externo"**.
   - Preencha nome do app (`Sinistro360`), e-mail de suporte e e-mail de
     contato do desenvolvedor (pode ser o seu mesmo).
   - Salve e continue até o final (não precisa preencher tudo, só o
     obrigatório).
   - Na etapa **"Usuários de teste"**, clique em **"+ Adicionar usuários"**
     e cadastre o(s) e-mail(s) @gmail.com que você vai usar pra conectar
     (enquanto o app estiver em modo "Teste", só esses e-mails conseguem
     logar — é justamente isso que evita precisar da revisão do Google,
     que demora e não é gratuita pra escopos sensíveis).
   - Na etapa **"Dados de acesso"/"Escopos"** ("Scopes"), clique em
     **"Adicionar ou remover escopos"** e marque, além do
     `.../auth/gmail.readonly` que já deve estar lá, também
     `.../auth/gmail.modify` e `.../auth/gmail.send` (aparecem na lista
     como "Ler, compor, enviar e excluir permanentemente e-mail..." /
     "Gerenciar rótulos..." — marque as opções da **Gmail API**, não do
     Gmail "básico"). Salve.
   - **Se você já tinha conectado o Gmail antes** dessa mudança, precisa
     desconectar e conectar de novo no sistema (Configurações → E-mails ou
     no módulo E-mails) pra que a tela do Google peça essas novas
     permissões — o token antigo só tinha a de leitura.

4. Ainda em "APIs e serviços", vá em **"Biblioteca"**, busque **"Gmail API"**
   e clique em **"Ativar"**.

5. Vá em **"APIs e serviços" → "Credenciais"** → **"+ Criar credenciais"** →
   **"ID do cliente OAuth"**.
   - Tipo de aplicativo: **"Aplicativo da Web"**.
   - Nome: `Sinistro360 - Web`.
   - **"Origens JavaScript autorizadas"**: adicione
     `https://brunobatalha9991.github.io`
   - Não precisa preencher "URIs de redirecionamento" (o fluxo usado não
     precisa disso).
   - Clique em **"Criar"**.

6. Copie o **"ID do cliente"** gerado (termina com
   `.apps.googleusercontent.com`) e me envie.

## O que fazer com o Client ID depois

Assim que eu tiver o Client ID, configuro em Configurações → Gmail
(E-mails) e o módulo "E-mails" passa a também aceitar conectar via Gmail,
usando a mesma identificação automática de processo, alerta no processo e
vínculo manual já feitos pro Outlook.
