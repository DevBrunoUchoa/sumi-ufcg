# Módulo `planos` — motor de tipo_plano / nó_plano

Implementado na Sprint 1–2. Decisões de modelo em
[`docs/adr/0004-modelo-tipo-plano-no-plano.md`](../../../../docs/adr/0004-modelo-tipo-plano-no-plano.md).

```
planos.types.ts        # TipoPlano, NoPlano, CampoDef, NivelDef
planos.schema.ts        # validação Zod de entrada (esquemaNiveis sequencial, etc.)
planos.repository.ts    # acesso a dados via supabase-js (tabelas + RPC arvore_no_plano)
planos.service.ts       # motor: validarDados, nivel do nó, mover, remover, árvore
planos.routes.ts        # Router Express, montado em app.ts
planos.service.test.ts  # testes unitários com repositórios fake (sem Supabase real)
```

## Endpoints

- `GET /tipos-plano` (`?ativos=true` filtra), `GET /tipos-plano/:id`
- `POST /tipos-plano`, `PATCH /tipos-plano/:id` (só `nome`/`descricao`/`ativo`)
- `GET /nos-plano?noPaiId=...` (omitido ou `"null"` = nós raiz)
- `GET /nos-plano/:id`, `GET /nos-plano/:id/arvore` (subárvore completa)
- `POST /nos-plano`, `PATCH /nos-plano/:id` (atualiza `dados`)
- `POST /nos-plano/:id/mover` (reordenar/reparentar — ver limitação abaixo)
- `DELETE /nos-plano/:id` (bloqueado se o nó tiver filhos)

## Limitações conhecidas (fora do escopo da Sprint 2)

- `mover` só troca de pai dentro do **mesmo nível** (não recalcula `nivel`
  de subárvores movidas para outra profundidade).
- Sem exclusão em cascata (nó com filhos precisa ser esvaziado antes).
- Sem autenticação/autorização própria — rotas `/tipos-plano` e
  `/nos-plano` continuam abertas mesmo com o módulo `auth` já implementado
  (ver README.md do diretório pai): o frontend aprovado fala com
  `/api/v1/planning/workspace` (módulo `planning`, que aplica autorização),
  não com este CRUD genérico. Se este CRUD vier a ser exposto diretamente
  (ex.: uma futura tela de administração de modelos), aplicar
  `sessionMiddleware`/`pode(...)` aqui também.
- indicadores/riscos acabaram implementados como parte do módulo
  `planning`, não como módulos próprios — ver README.md do diretório pai.
