<h1 align="center">SUMI-UFCG</h1>

<p align="center">Sistema de gestão e acompanhamento de planos institucionais da Universidade Federal de Campina Grande.</p>

---

## Sobre o projeto

O SUMI-UFCG é desenvolvido no âmbito do Smart Campus da UFCG. O projeto propõe uma aplicação institucional para estruturar, acompanhar e registrar a execução de planos, preservando as particularidades dos processos conduzidos pela universidade.

---

## Estrutura do repositório

Workspace pnpm (`pnpm-workspace.yaml`), um pacote por diretório na raiz:

```
backend/    # API (Express + TypeScript), ver backend/README.md
frontend/   # interface web (React + Vite)
```

---

## Ambiente de desenvolvimento

O repositório utiliza Node.js 24 e pnpm 11. As versões declaradas devem ser respeitadas para manter a instalação reproduzível entre os ambientes locais e a integração contínua.

```bash
corepack enable
pnpm install --frozen-lockfile

# rodar o backend em modo desenvolvimento
pnpm --filter backend dev
```

As configurações de cada aplicação são derivadas do respectivo `.env.example`
(ex.: `backend/.env.example`). Credenciais e dados institucionais permanecem
fora do histórico do Git.

---

## Infraestrutura

A configuração inicial de runtime, ambiente e integração contínua está descrita em [`docs/infrastructure.md`](docs/infrastructure.md). A containerização será incorporada após a definição dos comandos de build e inicialização da aplicação.

## Decisões de arquitetura

Decisões técnicas relevantes são registradas em [`docs/adr`](docs/adr) (Architecture Decision Records).
