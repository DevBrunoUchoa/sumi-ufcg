# ADR 0001: Monólito modular com workspace pnpm

**Status:** Aceita
**Data:** 29 de agosto de 2026

## Contexto

O SUMI-UFCG reúne interface web, regras de negócio e acesso a dados em uma única aplicação institucional. O desenvolvimento é dividido entre frontend, backend e infraestrutura, com uma única unidade executável para implantação.

O frontend utiliza React com Vite no diretório `frontend`. O backend compõe o mesmo workspace e compartilha as versões de Node.js, o gerenciador de dependências, os comandos de validação e o processo de build definidos na raiz do repositório.

## Decisão

O sistema adota um monólito modular organizado como workspace pnpm. Cada módulo mantém seu código e manifesto no próprio diretório, enquanto a raiz concentra o lockfile, os comandos agregadores, a integração contínua e a configuração de containerização.

O workspace utiliza Node.js 24 e pnpm 11. A instalação ocorre pela raiz com `pnpm install --frozen-lockfile`. Os comandos `pnpm dev`, `pnpm lint` e `pnpm build` encaminham a execução aos módulos da aplicação.

Os artefatos de build são reunidos em `dist`, com o frontend em `dist/frontend`. O servidor da aplicação é iniciado por `pnpm start`, utiliza a porta `3000` e disponibiliza `GET /health`.

A aplicação é distribuída em uma única imagem Docker. Configurações e credenciais são fornecidas por variáveis de ambiente e permanecem fora da imagem e do código entregue ao navegador.

## Consequências

A organização separa o desenvolvimento de frontend e backend sem criar serviços independentes. As dependências permanecem reproduzíveis por meio de um único lockfile, e as verificações executadas localmente correspondem às verificações da integração contínua.

Todo módulo é registrado no `pnpm-workspace.yaml` e integrado aos comandos da raiz. Alterações nos contratos de build, inicialização, porta ou verificação de disponibilidade abrangem a aplicação, o Docker, o Compose e a documentação de infraestrutura.
