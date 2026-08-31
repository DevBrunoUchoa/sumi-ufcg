# Infraestrutura

A base utiliza Node.js 24 e pnpm 11. As versões são declaradas no repositório e a instalação respeita o arquivo de lock, mantendo o ambiente local e a integração contínua sob o mesmo contrato.

A configuração da aplicação será fornecida por variáveis de ambiente. O arquivo de exemplo registra somente os nomes esperados e valores locais não sensíveis. Credenciais administrativas do Supabase permanecem no processo de backend e não recebem prefixos destinados ao código entregue ao navegador.

O fluxo inicial de integração contínua valida a instalação reproduzível das dependências. As verificações de lint, tipos, testes e build serão incorporadas quando os respectivos comandos existirem na aplicação.

O código do backend está em `backend/` (workspace pnpm, ver `docs/adr/0003-stack-backend.md`), que já expõe os comandos de build e inicialização. A imagem Docker e o ambiente de Compose serão definidos a partir desse pacote. Essa definição deverá produzir uma única unidade de implantação para o monólito, executar com usuário sem privilégios e limitar a retenção dos logs do contêiner.

Os ambientes de desenvolvimento, homologação e produção utilizarão configurações independentes. Segredos, credenciais e dados institucionais não pertencem ao histórico do repositório.
