# SUMI Frontend

Frontend do Sistema Unificado de Monitoramento Institucional da UFCG. A
aplicação organiza planos institucionais, execução, indicadores, metas,
riscos, histórico e validação por escopo de acesso.

Este código veio do protótipo navegável (`sumi-prototipo`), aprovado pelo
time de produto para o layout e os fluxos de tela, e foi conectado aqui ao
backend real (`../backend`) e ao Postgres/Supabase — ver
[`docs/adr/0005-integracao-workspace-real.md`](../docs/adr/0005-integracao-workspace-real.md).

## Execução local

```sh
pnpm install --frozen-lockfile
pnpm --filter frontend dev
```

A aplicação fica disponível em `http://127.0.0.1:4317`. Por padrão, o modo de
desenvolvimento usa registros locais isolados (fixtures em `dev/`); para
testar contra o backend real, rode o backend (`pnpm --filter backend dev`) e
suba o frontend com `VITE_DATA_SOURCE=http`.

Sessões disponíveis para validação local (fixtures, não passam pelo backend):

- administrador: `http://127.0.0.1:4317/__dev/session/administrator`
- consulta pública: `http://127.0.0.1:4317/__dev/session/public`
- gestor de eixo: `http://127.0.0.1:4317/__dev/session/axis_contributor`
- responsável pelo eixo: `http://127.0.0.1:4317/__dev/session/axis_reviewer`

Para autenticar contra o backend real, acesse `#/login` (ver
`src/auth/Login.jsx`) com um usuário semeado por `pnpm --filter backend seed`.

## Integração

A interface consome identidade e autorizações exclusivamente por concessões
retornadas em `GET /api/v1/auth/session`. Os componentes não autorizam ações
pelo nome do papel.

O acesso aos planejamentos fica concentrado em `src/planning-client.js`:

- `GET /api/v1/planning/workspace`
- `PUT /api/v1/planning/workspace`

Variáveis disponíveis (ver `.env.example`):

- `VITE_API_BASE_URL`: origem da API, vazia para mesma origem;
- `VITE_AUTH_SESSION_PATH`: caminho do endpoint de sessão;
- `VITE_PLANNING_WORKSPACE_PATH`: caminho do endpoint agregado de planejamento;
- `VITE_DATA_SOURCE`: `local` para dados de desenvolvimento ou `http` para a API.

## Verificação

```sh
pnpm --filter frontend test
pnpm --filter frontend test:e2e
pnpm --filter frontend build
```

## Organização

```text
dev/                  Sessões locais de desenvolvimento (não usadas em produção)
src/auth/             Sessão, concessões, escopos e a tela de login
src/data.js           Dados locais de desenvolvimento
src/domain.js         Regras de apresentação e cálculo
src/forms.jsx         Formulários de domínio
src/planning-client.js Adaptador da fonte de planejamentos
src/main.jsx          Navegação e fluxos de tela
src/styles.css        Sistema visual responsivo
tests/                Testes de regras e fluxos no navegador
```
