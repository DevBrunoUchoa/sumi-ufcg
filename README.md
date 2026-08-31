<h1 align="center">SUMI-UFCG</h1>

<p align="center">Sistema de gestão e acompanhamento de planos institucionais da Universidade Federal de Campina Grande.</p>

## Estrutura

```text
sumi-ufcg/
├── .github/workflows/   Integração contínua
├── docs/                Arquitetura e decisões arquiteturais
├── backend/             API (Express + TypeScript)
│   └── src/             Código-fonte do servidor e dos módulos de domínio
├── frontend/            Aplicação web em React
│   └── src/             Código-fonte da interface
├── supabase/migrations/ Migrações versionadas do banco (Postgres/Supabase)
├── Dockerfile           Construção da imagem da aplicação
├── compose.yaml         Execução local em contêiner
├── package.json         Comandos e versões do projeto
└── pnpm-workspace.yaml  Módulos do workspace
```

## Requisitos

```text
Node.js 24
pnpm 11
Docker
```

## Instalação

```bash
corepack enable
pnpm install --frozen-lockfile
```

As configurações de cada pacote são derivadas do respectivo `.env.example`
(`backend/.env.example`). Credenciais e dados institucionais permanecem fora
do histórico do Git.

## Desenvolvimento

```bash
pnpm dev
```

Sobe `frontend` e `backend` em paralelo. Para rodar só um dos dois:
`pnpm --filter backend dev` ou `pnpm --filter frontend dev`.

## Verificações

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Docker

```bash
docker compose build
```

## Documentação

- [Arquitetura do sistema](docs/architecture.md)
- [Decisões arquiteturais](docs/adr)
