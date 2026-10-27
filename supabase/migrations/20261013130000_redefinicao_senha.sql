-- Redefinição de senha self-service
--
-- Até agora toda redefinição de senha passava pelo Admin editando a conta
-- manualmente na tela de Usuários — com várias unidades da UFCG usando o
-- SUMI, isso vira gargalo. Esta tabela guarda os tokens de uso único
-- enviados por e-mail quando alguém pede "esqueci minha senha"
-- (ver backend/src/modules/auth/auth.service.ts).
--
-- Mesmo padrão de `sumi_sessao`: o próprio uuid gerado pelo banco é o token (não
-- há um hash separado) — é aleatório e não-adivinhável o bastante, e evita
-- duplicar a lógica de hash/verificação só para isto.

create table if not exists sumi_redefinicao_senha (
  token uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references sumi_usuario (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  -- Marca o momento em que o token foi usado, tornando-o inválido para
  -- reuso — null enquanto o token ainda não foi consumido.
  usado_em timestamptz
);

create index if not exists sumi_redefinicao_senha_usuario_idx on sumi_redefinicao_senha (usuario_id);

comment on table sumi_redefinicao_senha is 'Tokens de uso único para redefinição de senha self-service, enviados por e-mail — expiram em 1h (ver DURACAO_REDEFINICAO_MS em auth.service.ts) e ficam marcados como usados após a troca de senha.';
