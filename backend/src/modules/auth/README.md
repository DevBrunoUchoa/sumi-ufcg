# auth

Contrato de sessão e permissões definido em **PR #6** (Fel-tby,
`feat(auth): define contrato v1 de sessão e permissões`, `auth.contract.ts`)
e implementado por completo (login, logout, sessão real por cookie,
persistência, middleware) como parte da integração com o frontend aprovado
— ver
[`docs/adr/0005-integracao-workspace-real.md`](../../../../docs/adr/0005-integracao-workspace-real.md).

```
auth.contract.ts       # contrato v1 (PR #6): PERMISSION_CODES, ROLE_CODES, escopos, schemas Zod da sessão
auth.contract.test.ts  # testes do contrato (herdados da PR #6, lista de permissões atualizada)
auth.types.ts          # Escopo/Concessao/Papel (alias dos tipos do contrato) + SessaoUsuario, Usuario
auth.permissions.ts    # composição de concessões por perfil (espelha o frontend)
auth.repository.ts     # usuario / sessao / eixos (para calcular concessões)
auth.service.ts        # login, logout, montarSessao (valida contra authenticatedSessionSchema antes de responder)
auth.can.ts             # pode(sessao, permissao, recurso) — espelha src/auth/permissions.js do frontend
auth.middleware.ts      # resolve req.sumiSession a partir do cookie em toda requisição
auth.routes.ts           # POST /login, POST /logout, GET /session
```

## Diferenças em relação à PR #6

A PR #6 definiu **13** códigos de permissão — os usados pela versão do
frontend disponível em 10/09. O frontend aprovado em 13/09 já usa mais
4 (`item.submit`, `item.review`, `work_queue.read`, `review_queue.read` —
o fluxo de "Minhas pendências"/"Validações"), então `PERMISSION_CODES`
aqui tem **17**. O restante do contrato (papéis, escopos, formato da
sessão 200/401, regra de decisão) é o mesmo.

A PR #6 deliberadamente não implementou nada além do contrato (schemas e
documentação, rota não registrada em `app.ts`) — aqui o módulo está
implementado de ponta a ponta: login/logout reais, sessão persistida
(tabela `sessao`), senha com hash, e `sessionMiddleware` aplicado a toda
requisição.

## Modelo

Só existe um papel global no banco (`usuario.papel_admin`, "Administrador
Estratégico"). Gestor do Eixo e Responsável pelo Eixo **não são papéis
próprios** — são derivados da presença do `usuario.id` em
`no_plano.dados.managerIds`/`reviewerIds` de cada eixo. Ver a ADR para a
composição exata de concessões por perfil.

## Sessão

Cookie httpOnly opaco (`sumi_session`), token em `sessao.token`, sem JWT.
Senha com `scrypt` (`node:crypto`), sem dependência externa. `GET /session`
responde `401` com `{"error":{"code":"UNAUTHENTICATED","message":"..."}}`
quando não há sessão válida (o frontend trata `401` como consulta pública
e não lê esse corpo — ele existe para consumidores que precisem dele).

## Limitações conhecidas

- Não há endpoint de administração de usuários nem de atribuição de
  gestores/responsáveis por eixo — hoje isso é feito via
  `backend/scripts/seed.ts` ou escrita direta no banco, porque o
  protótipo aprovado não tem tela para isso (ver ADR 0005).
- Login é e-mail/senha, não GOV.BR — fora do escopo desta integração
  (ver "Fora do contrato v1" na PR #6).
