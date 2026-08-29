# Arquitetura do sistema

## Organização

O SUMI-UFCG adota um monólito modular organizado como workspace pnpm. A interface, o servidor e os módulos de domínio integram o mesmo repositório, compartilham o processo de validação e produzem uma única unidade de implantação da aplicação.

## Interface

A interface utiliza React, Vite e Tailwind CSS. O módulo `frontend` concentra componentes, páginas, navegação e comunicação com a API. O código entregue ao navegador recebe somente configurações públicas e não contém credenciais administrativas.

## Servidor

O servidor utiliza Node.js e concentra regras de negócio, autorização, validação de arquivos, importação de dados e acesso privilegiado aos serviços institucionais. A aplicação é iniciada por `pnpm start`, atende na porta `3000` e disponibiliza `GET /health`.

## Persistência

A persistência utiliza PostgreSQL por meio do Supabase. O banco armazena dados dos planos institucionais, usuários, permissões, registros de acompanhamento e trilhas de auditoria. O esquema e suas alterações são mantidos por migrações versionadas no repositório.

O acesso administrativo ao Supabase permanece no servidor. A chave de serviço não é exposta no frontend. Backups, retenção e rotação dos registros seguem políticas explícitas para cada ambiente.

## Build e implantação

O workspace utiliza Node.js 24 e pnpm 11, com um único lockfile. Os comandos da raiz coordenam desenvolvimento, lint e build dos módulos. Os artefatos são reunidos em `dist`, com a interface em `dist/frontend`.

A aplicação é empacotada em uma imagem Docker e executada com Docker Compose. O contêiner opera sem privilégios, utiliza filesystem somente leitura e limita a retenção dos logs. Configurações e credenciais são fornecidas por variáveis de ambiente.

## Decisões arquiteturais

As decisões e suas consequências são registradas no diretório `docs/adr`.
