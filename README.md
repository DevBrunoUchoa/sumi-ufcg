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
docker compose up -d --build
```

A aplicação fica em `http://localhost:3000`. O Compose lê as credenciais
de `backend/.env` (ignorado pelo Git). Para parar: `docker compose down`.
O contêiner usa o Supabase configurado nesse arquivo; ele não cria um banco
Postgres local.

## Execução nesta instalação Windows

O Node 24 e o pnpm 11 portáteis ficam em `.tools/`, na mesma unidade do projeto.
Para reinstalar dependências aqui, execute
`.tools\pnpm.cmd install --frozen-lockfile --store-dir .tools/pnpm-store`.
Com `backend/.env` preenchido, execute `iniciar-local.cmd` para compilar e
iniciar frontend e API em `http://localhost:3000`. A variável
`SESSION_COOKIE_SECURE=false` é necessária nesse arquivo para login via
`http://localhost`; em um ambiente HTTPS de produção, deixe-a vazia.

O Docker Desktop desta máquina guarda os discos WSL em `E:\Docker\wsl`.

## Documentação

- [Arquitetura do sistema](docs/architecture.md)
- [Decisões arquiteturais](docs/adr)
