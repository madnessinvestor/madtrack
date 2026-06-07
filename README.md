🚀 MadTrade

MadTrade é um gerenciador de portfólio de criptomoedas desenvolvido em Python com Tkinter, focado em simplicidade, desempenho e visual moderno para acompanhamento de investimentos.

O aplicativo permite registrar compras de ativos, acompanhar o valor atual do portfólio em tempo real, analisar lucro/prejuízo e visualizar o histórico completo das operações.

✨ Funcionalidades

📊 Dashboard do Portfólio
Total investido
Valor atual da carteira
Lucro / prejuízo total
Retorno percentual (ROI)

💰 Gestão de Ativos
Adicionar novos ativos
Editar posições
Remover ativos
Atualização automática de preços

📈 Métricas por Ativo
Quantidade total
Preço médio
Valor investido
Valor atual
Lucro / prejuízo
Percentual de retorno
Break-even

📝 Histórico de Trades
Registro de compras
Data e hora das operações
Quantidade adquirida
Valor investido
Visualização expandida por ativo

🎨 Interface
Tema Dark
Tema Light
Ajuste de tamanho de fonte
Interface responsiva
Suporte a Português (PT-BR) e Inglês (EN-US)

💾 Persistência de Dados
Salvamento local em JSON
Carregamento automático ao iniciar
Exportação de dados

📸 Screenshots

Dashboard
TOTAL INVESTED
$208,000
CURRENT VALUE
$67,376
PERFORMANCE
-$140,623 (-67%)
Ativos
BTC
Preço Atual: $61,558
P/L
-$66,441 (-51.91%)
Histórico
BUY 0.50 BTC
Investido:
$30,000

Data:
07/06/2026 17:03
🛠 Tecnologias Utilizadas
Python 3
Tkinter
JSON
urllib
Threading
PyInstaller

📦 Instalação
Windows (Recomendado)
💡 Basta executar o arquivo build.bat.
O script realiza automaticamente:

Criação do ambiente virtual (.venv)
Instalação das dependências
Compilação do executável com PyInstaller
Passos
Clone ou baixe o projeto:
git clone https://github.com/seuusuario/MadTrade.git
Entre na pasta do projeto.
Execute:
build.bat
Aguarde a conclusão do processo.

O executável será gerado em:

dist/
▶️ Executar pelo Código-Fonte

Caso queira executar diretamente pelo Python:

python MadTrade.py
🔨 Compilação Manual

Caso não queira utilizar o build.bat:

pyinstaller --onefile --windowed --icon=madicon.ico MadTrade.py

Ou:

pyinstaller ^
--onefile ^
--windowed ^
--icon=madicon.ico ^
--add-data "madicon.ico;." ^
MadTrade.py
📁 Estrutura do Projeto
MadTrade/
│
├── MadTrade.py
├── portfolio_data.json
├── madicon.ico
├── build.bat
├── README.md
│
├── assets/
│   ├── icons/
│   └── screenshots/
│
├── dist/
└── .venv/
🎯 Objetivo do Projeto

O MadTrade foi criado para fornecer uma forma rápida e intuitiva de acompanhar investimentos em criptomoedas sem depender de exchanges ou plataformas externas.

A proposta é oferecer:

Controle total dos dados
Armazenamento local
Interface leve
Atualização rápida
Visual focado em traders e investidores
🔒 Privacidade

Todos os dados são armazenados localmente no computador do usuário.

O aplicativo:

Não exige login
Não envia informações pessoais
Não armazena chaves privadas
Não requer integração obrigatória com corretoras

O controle dos dados permanece totalmente com o usuário.

🚧 Roadmap
 Integração com Binance
 Integração com Bybit
 Alertas de preço
 Gráfico de evolução do portfólio
 Múltiplas carteiras
 Backup em nuvem
 Modo compacto para telas pequenas
 Estatísticas avançadas
 Importação automática de operações
 Dashboard responsivo para diferentes resoluções
 
🤝 Contribuições
Sugestões, correções e melhorias são sempre bem-vindas.
Faça um Fork do projeto
Crie uma Branch:
git checkout -b minha-feature
Faça suas alterações
Envie um Pull Request

📄 Licença
Este projeto está licenciado sob a Licença MIT.

Sinta-se livre para utilizar, modificar e distribuir.

👨‍💻 Autor
Mad

Desenvolvido para acompanhamento pessoal de investimentos em criptomoedas, com foco em simplicidade, desempenho e controle total dos dados.

⭐ Se o projeto foi útil para você, considere deixar uma estrela no GitHub.
