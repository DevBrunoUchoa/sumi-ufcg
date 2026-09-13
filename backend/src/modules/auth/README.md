# auth

Implementado como parte da integração com o frontend aprovado — ver
[`docs/adr/0005-integracao-workspace-real.md`](../../../../docs/adr/0005-integracao-workspace-real.md).

```
auth.types.ts        # Escopo, Concessao, SessaoUsuario, Usuario
auth.permissions.ts  # lista de permissões e composição por perfil (espelha o frontend)
auth.repository.ts   # usuario / sessao / eixos (para calcular concessões)
auth.service.ts      # login, logout, montarSessao (grants a partir de papel_admin + managerIds/reviewerIds)
auth.can.ts          # pode(sessao, permissao, recurso) — espelha src/auth/permissions.js do frontend
auth.middleware.ts   # resolve req.sumiSession a partir do cookie em toda requisição
auth.routes.ts        # POST /login, POST /logout, GET /session
```

## Modelo

Só existe um papel global no banco (`usuario.papel_admin`, "Administrador
Estratégico"). Gestor do Eixo e Responsável pelo Eixo **não são papéis
próprios** — são derivados da presença do `usuario.id` em
`no_plano.dados.managerIds`/`reviewerIds` de cada eixo. Ver a ADR para a
composição exata de concessões por perfil.

## Sessão

Cookie httpOnly opaco (`sumi_session`), token em `sessao.token`, sem JWT.
Senha com `scrypt` (`node:crypto`), sem dependência externa.

## Limitações conhecidas

- Não há endpoint de administração de usuários nem de atribuição de
  gestores/responsáveis por eixo — hoje isso é feito via
  `backend/scripts/seed.ts` ou escrita direta no banco, porque o
  protótipo aprovado não tem tela para isso (ver ADR 0005).
