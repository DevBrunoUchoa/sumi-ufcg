-- CPF do usuário, para o login com GOV.BR
--
-- O GOV.BR identifica a pessoa pelo CPF (claim `sub` do ID token). O
-- administrador pode cadastrá-lo na tela de Usuários; se não houver, o
-- primeiro login pelo GOV.BR liga a conta pelo e-mail verificado e grava o
-- CPF aqui (ver authService.autenticarGovbr). Só dígitos; único quando
-- preenchido.

alter table sumi_usuario add column if not exists cpf text;

alter table sumi_usuario drop constraint if exists sumi_usuario_cpf_formato;
alter table sumi_usuario
  add constraint sumi_usuario_cpf_formato check (cpf is null or cpf ~ '^[0-9]{11}$');

create unique index if not exists sumi_usuario_cpf_unico on sumi_usuario (cpf);

comment on column sumi_usuario.cpf is 'CPF (só dígitos) que liga a conta ao login com GOV.BR; null enquanto não ligada.';

notify pgrst, 'reload schema';
