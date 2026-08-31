# ADR 0002

## Contexto

O SUMI-UFCG mantém estruturas hierárquicas de planejamento, usuários, responsabilidades, períodos de acompanhamento, evidências e registros de auditoria. Esses dados possuem relações, restrições de integridade e histórico de alterações.

A aplicação também exige ambientes reproduzíveis, controle versionado do esquema e separação entre configurações públicas e credenciais administrativas.

## Decisão

A persistência utiliza PostgreSQL disponibilizado pelo Supabase. O esquema representa os planos institucionais e seus relacionamentos por meio de tabelas, chaves, restrições e índices. Toda alteração estrutural é registrada como migração versionada no repositório.

O servidor concentra operações privilegiadas e o uso da chave de serviço do Supabase. O frontend não recebe credenciais administrativas nem executa operações que ultrapassem o nível de acesso do usuário autenticado.

As ações relevantes para segurança e rastreabilidade são registradas em estruturas próprias de auditoria. Backups, retenção e rotação são configurados por ambiente sem alterar o modelo funcional da aplicação.

## Consequências

O modelo relacional mantém a integridade entre planos, unidades, usuários, metas, indicadores e acompanhamentos. Migrações versionadas permitem reproduzir e revisar a evolução do banco entre desenvolvimento, homologação e produção.

O uso do Supabase fornece a infraestrutura de PostgreSQL e seus recursos operacionais sem transferir regras de negócio para o frontend. O servidor permanece responsável pela autorização, validação e consistência das operações institucionais.
