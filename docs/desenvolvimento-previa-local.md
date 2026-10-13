# Base de planejamento para desenvolvimento local

O frontend pode carregar as matrizes XLSX de `docs_locais/eixos` e as matrizes
`Monitoramento Eixo*.xlsx` diretamente em `docs_locais`, sem subir o backend,
configurar credenciais ou acessar o Supabase.

Depois de instalar as dependências, execute na raiz:

```powershell
pnpm --filter backend previa-local
pnpm --filter frontend dev
```

O primeiro comando apenas lê os arquivos. Ele reutiliza o leitor de importação
extraído em `importacao.leitura.ts`, sem importar serviços de banco ou `.env`.
Gera `.local-preview/workspace.json` e `.local-preview/manifest.json`, ambos
ignorados pelo Git. O manifesto registra os hashes das fontes, os cenários por
iniciativa e as inconsistências encontradas. Os XLSX permanecem intactos.

O middleware `/__dev/planning/workspace` lê a base gerada apenas no modo local
de desenvolvimento. Sem ela, continua oferecendo os exemplos originais.
`VITE_DATA_SOURCE=http` continua usando a API real. Os documentos e o JSON
privado não são importados pelo bundle de produção.

## Acessos locais

A prévia inicia como visitante. Entre pelo formulário em `/#/login` usando
uma das contas fictícias abaixo; todas têm a senha `SumiLocal123!`.

| Perfil | E-mail | Escopo |
| --- | --- | --- |
| Administrador Estratégico | admin@sumi.local | Administração dos planos e modelos |
| Gestor do Eixo | gestor@sumi.local | Execução e resultados do eixo 8 do PDI |
| Responsável pelo Eixo | responsavel@sumi.local | Validação do eixo 8 do PDI e eixos 1, 3 e 7 do PLS |

Essas contas vivem somente no middleware do Vite, sem backend ou usuários no
banco. São desativadas em produção e com `VITE_DATA_SOURCE=http`. Login mantém
o perfil em cookie HttpOnly; Sair retorna à consulta pública. Os atalhos
`/__dev/session/{administrator,axis_contributor,axis_reviewer,public}` continuam
disponíveis para testes. As regressões escolhem seu perfil explicitamente.

## Dados documentais e situações de teste

Códigos, títulos, objetivos, indicadores, linha de base, metas, ações, etapas,
avaliação e descrição dos riscos vêm das planilhas. PRGAF e SEPLAN alimentam
o mesmo eixo 8; iniciativas repetidas entre arquivos causam erro explícito.
Valores percentuais respeitam a formatação do Excel. Fórmulas não são
executadas: só se leem resultados existentes em cache.

Execução por etapa não é assumida como resultado do indicador. As expressões
originais de metas e execução ficam em `extras`, e as metas textuais, como
`>90%`, também aparecem na referência do indicador. Metas sem interpretação
numérica segura não recebem uma comparação automática. Riscos cuja descrição
de etapa diverge do monitoramento ficam vinculados à ação, com aviso no manifesto.

A carga cria cenários identificados de execução concluída, andamento, atraso,
validação pendente, correção e planejamento. Prazos, resultados trimestrais,
validações e avanço dos tratamentos são simulados. Fontes, observações e
histórico identificam a simulação.
Não se inventam anexos nem resultados de anos futuros.

## Persistência e migração

As alterações continuam salvas no navegador. Uma revisão da carga é aplicada
uma única vez: recarregar não desfaz alterações nem repõe itens excluídos.
A primeira migração guarda a base anterior em
`sumi.frontend.workspace.v2.backup.before-local-preview` no localStorage.
Edições existentes prevalecem sobre a carga; exemplos originais intactos são
substituídos. Outros planos, permissões, IDs existentes e unidades personalizadas
são preservados. Uma regeneração idêntica mantém a mesma revisão e os mesmos IDs do PDI.

Os testes de regressão usam os exemplos públicos estáveis. Os testes
`local-preview.spec.js` validam os oito eixos, a persistência de etapas, o escopo
dos riscos e a migração quando a base privada está presente; são ignorados
automaticamente em ambientes sem os documentos locais.
