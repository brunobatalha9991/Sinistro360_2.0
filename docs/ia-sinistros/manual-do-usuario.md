# Manual do Usuário — IA Corporativa Sinistros 360

## Assistente IA (menu lateral → "Assistente IA")

Converse em português normal. Exemplos que funcionam hoje:
- "Quantos sinistros em andamento por seguradora?"
- "Busque os sinistros da Porto Seguro em atraso"
- "Quais filtros existem na tela de Sinistros?"
- "Como é calculado o TMA no Dashboard?"
- "Como está o desempenho da Marina este mês?"
- "Crie uma tarefa pra cobrar o sinistro 2026.001.9001" (pede confirmação antes de gravar)

Cada resposta mostra, quando aplicável: um selo de confiança, as fontes consultadas (com link direto pro sinistro), a metodologia de cálculo, e avisos quando a resposta não teve base em dado real do sistema.

**Ações de escrita** (criar tarefa, editar campo de sinistro) sempre aparecem como uma proposta com "Confirmar"/"Cancelar" — nada é gravado antes desse clique. Se seu perfil for `consulta`, a IA nem propõe.

**Ensinar o assistente** (botão 🎓 acima do chat): ensina uma preferência ou informação para ele lembrar. "Só para mim" já vale na próxima pergunta. "Para minha equipe"/"Para toda a corretora" fica pendente até um administrador aprovar em Configurações.

**Feedback**: use os botões 👍/👎/⚠/💬 embaixo de cada resposta para avaliar.

## Histórico de Responsabilidade (dentro de cada sinistro)

Nova aba na tela de detalhe do sinistro. Mostra quem foi responsável, quando começou/terminou, e a origem (real ou estimada a partir de dados antigos). Se estiver vazia, um administrador pode gerar uma estimativa em Configurações.

## Desempenho (menu lateral → "Desempenho", se seu usuário tiver acesso)

Escolha um período (ou "Todo o histórico") e veja, por usuário: quantos processos assumiu, quantos passaram pela responsabilidade dele, quantos tem hoje em carteira, quantos estão atrasados, e o tempo médio que fica responsável por um processo. Clique em "Ver sinistros" pra abrir a lista filtrada.

## Configurações (só administradores)

- **Histórico de Responsabilidade — migração**: gera estimativa de histórico pra processos antigos que não têm. Pode rodar várias vezes sem duplicar.
- **Memórias da IA**: aprova ou rejeita sugestões de conhecimento de equipe/organizacional feitas pelos usuários no chat; pode "expirar" uma memória aprovada a qualquer momento.
