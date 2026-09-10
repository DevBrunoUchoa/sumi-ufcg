# Contrato de autenticação e autorização

## Estado

O contrato v1 entre frontend e backend está definido em `auth.contract.ts` e protegido por `auth.contract.test.ts`.

Este módulo **ainda não autentica pessoas, não consulta o GOV.BR, não persiste concessões e não registra a rota em `app.ts`**. Isso é intencional: o contrato foi fechado antes da implementação para que o backend real possa substituir as fixtures do protótipo sem espalhar regras de papel pela interface.

## Endpoint da sessão

```http
GET /api/v1/auth/session
Accept: application/json
Cookie: <credencial de sessão HttpOnly>
```

O navegador chama o endpoint com `credentials: include`.

### Sessão autenticada

Quando a credencial é válida, a API responde `200 OK`:

```json
{
  "authenticated": true,
  "user": {
    "id": "uuid-ou-identificador-opaco",
    "name": "Nome da pessoa",
    "email": "pessoa@ufcg.edu.br"
  },
  "roles": [
    {
      "code": "AXIS_CONTRIBUTOR",
      "name": "Gestor do Eixo"
    }
  ],
  "grants": [
    {
      "permission": "plan.read_published",
      "scope": { "type": "global" }
    },
    {
      "permission": "result.create",
      "scope": {
        "type": "axis",
        "planId": "pdi-2026",
        "axisId": "eixo-8"
      }
    }
  ]
}
```

Regras do corpo:

- `authenticated` é sempre `true` numa resposta `200` deste endpoint;
- `user.id` é um identificador opaco, estável e não vazio;
- `user.email` pode ser `null` quando o provedor institucional não o disponibilizar;
- `roles` identifica os vínculos funcionais para apresentação e auditoria;
- `grants` contém as capacidades efetivas usadas para autorizar cada operação;
- uma sessão autenticada deve receber `plan.read_published` global para conservar a consulta pública;
- `roles` pode ser vazio, mas `grants` sempre contém ao menos a concessão pública global; autenticação, por si só, não concede acesso interno.

### Sessão ausente ou expirada

Quando não existe uma sessão institucional válida, a API responde `401 Unauthorized`:

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Sessão institucional ausente ou expirada."
  }
}
```

Ao receber `401`, o frontend cria localmente uma sessão pública com somente `plan.read_published` no escopo global. Consulta pública não é papel e não precisa de uma conta fictícia.

Uma falha interna ou de comunicação não deve ser transformada em `401`. Nesses casos, a API responde o erro adequado e o frontend mostra a opção de tentar novamente.

## Papéis funcionais

| Código | Nome funcional | Uso |
|---|---|---|
| `STRATEGIC_ADMIN` | Administrador Estratégico | Gestão institucional e visão global |
| `AXIS_CONTRIBUTOR` | Gestor do Eixo | Operação e atualização no escopo atribuído |
| `AXIS_REVIEWER` | Responsável pelo Eixo | Acompanhamento e futura validação no escopo atribuído |

Os papéis não autorizam ações diretamente no frontend. O backend resolve os vínculos do usuário e devolve os `grants` efetivos. Isso permite que uma pessoa acumule atribuições diferentes sem transformar uma hipótese de governança em código da interface.

## Permissões v1

| Código | Ação protegida no frontend atual |
|---|---|
| `plan.read_published` | Consultar planos publicados |
| `plan.read_internal` | Consultar conteúdo interno autorizado |
| `plan.manage` | Criar e administrar planos e sua estrutura |
| `model.manage` | Administrar modelos de plano |
| `item.edit` | Alterar dados de uma iniciativa ou item equivalente |
| `action.manage` | Criar e alterar ações |
| `stage.update` | Atualizar etapas |
| `indicator.edit_target` | Alterar metas de indicador |
| `result.create` | Registrar resultados e justificativas |
| `risk.read` | Consultar riscos internos |
| `risk.manage` | Criar e alterar riscos |
| `history.read` | Consultar histórico interno |
| `history.comment` | Registrar observações no histórico |

Somente esses códigos fazem parte da v1. O wildcard `*` é deliberadamente recusado pelo schema do backend, mesmo que a função utilitária atual do protótipo o compreenda. Sessões administrativas devem listar concessões explícitas.

Permissões futuras, como validar informações, solicitar correção, publicar conteúdo, emitir relatórios, anexar documentos, consultar auditoria ou administrar acessos, deverão ser acrescentadas quando seus fluxos forem confirmados pela SEPLAN.

## Escopos v1

| Tipo | Forma | Abrangência |
|---|---|---|
| `global` | `{ "type": "global" }` | Todos os recursos aos quais a permissão se aplica |
| `plan` | `{ "type": "plan", "planId": "..." }` | Um plano e seus recursos descendentes |
| `axis` | `{ "type": "axis", "planId": "...", "axisId": "..." }` | Um eixo de um plano |
| `item` | `{ "type": "item", "planId": "...", "itemId": "..." }` | Uma iniciativa ou item específico de um plano |

Os identificadores são opacos para o frontend. A API pode usar UUIDs, desde que devolva os mesmos valores utilizados nos recursos apresentados à interface.

Os schemas são estritos: campos ausentes ou extras tornam o grant inválido. Um escopo `axis`, por exemplo, sempre informa `planId` e `axisId`.

## Regra de decisão

Uma ação é permitida somente quando existe pelo menos um grant cuja permissão seja igual à capacidade solicitada e cujo escopo contenha o recurso.

```text
global -> qualquer recurso
plan   -> mesmo planId
axis   -> mesmos planId e axisId
item   -> mesmos planId e itemId
```

A ausência de grant significa acesso negado. `roles` nunca substitui essa verificação.

O frontend utiliza a regra para decidir o que exibir ou habilitar. O backend deverá repetir a autorização em toda leitura protegida e em toda mutação, inclusive filtrando coleções pelo escopo. A verificação do frontend não é uma barreira de segurança.

## Regras HTTP e de segurança para a implementação

- responder a sessão com `Content-Type: application/json` e `Cache-Control: no-store`;
- transportar a credencial em cookie `HttpOnly`, `Secure` em produção e com política `SameSite` compatível com a implantação;
- preferir frontend e API na mesma origem;
- se houver origens distintas, configurar CORS com origem explícita e credenciais, nunca com wildcard;
- usar `401` quando não há autenticação válida e `403` quando a pessoa está autenticada, mas não possui o grant necessário;
- não devolver token do provedor, segredo, CPF completo ou credencial administrativa no corpo da sessão;
- registrar alterações de papel, escopo e concessão na futura trilha de auditoria.

## Fora do contrato v1

Continuam pendentes de decisão e implementação:

- mecanismo de login e logout GOV.BR;
- persistência de usuários, vínculos, papéis e concessões;
- vigência, concessão e revogação de acessos;
- associação com unidades institucionais;
- impedimento de autoaprovação;
- validação, correção, publicação e notificações;
- administração de usuários;
- middleware de autorização das rotas de domínio.

Essas pendências não alteram a forma da sessão v1. Quando forem implementadas, o backend continuará entregando ao frontend apenas a identidade, os papéis informativos e os grants efetivos.
