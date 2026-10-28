import { useEffect, useState } from 'react';
import { Badge, Button, Empty, Field, Icon, Input } from './ui.jsx';
import { atualizarUsuario, criarUsuario, listarUsuarios, removerUsuario } from './admin-client.js';

// Espelha os pacotes fixos definidos em backend/auth.permissions.ts — texto
// de referência, não editável aqui. Gestor/Responsável são atribuídos por
// eixo na Estrutura de cada planejamento; os pacotes em si (o que cada um
// pode fazer) são fixos no código, por decisão do Plano de Negócio.
const PAPEIS = [
  {
    nome: 'Administrador Estratégico',
    resumo: 'Acesso total ao sistema.',
    permissoes: ['Gerenciar usuários e seus acessos', 'Gerenciar modelos de plano (PDI/PLS)', 'Editar a estrutura de qualquer plano (eixos, objetivos, Gestor/Responsável)', 'Publicar ou voltar um plano para rascunho', 'Editar objetivos, iniciativas, metas e ações de qualquer eixo', 'Todas as permissões de Gestor e Responsável, em qualquer eixo'],
  },
  {
    nome: 'Gestor do Eixo',
    resumo: 'Atribuído por eixo, na Estrutura do plano. Valida o que o Responsável Técnico envia.',
    permissoes: ['Ver o plano internamente (inclusive rascunhos)', 'Ver riscos', 'Ver e comentar no histórico', 'Validar ou solicitar correção nas iniciativas enviadas', 'Anexar documentos'],
  },
  {
    nome: 'Responsável Técnico do Eixo',
    resumo: 'Atribuído por eixo, na Estrutura do plano. Lança os dados até o nível da etapa.',
    permissoes: ['Ver o plano internamente (inclusive rascunhos)', 'Cadastrar e atualizar etapas', 'Registrar resultados dos indicadores', 'Ver e gerenciar riscos', 'Ver e comentar no histórico', 'Enviar iniciativas para validação', 'Anexar documentos'],
  },
];

// O CPF liga a conta ao login com gov.br (o GOV.BR identifica a pessoa por
// ele). O backend valida de novo; aqui é só para avisar antes de enviar.
const soDigitos = (valor) => String(valor || '').replace(/\D/g, '');
const formatarCpf = (cpf) => (cpf ? cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : '');
function cpfValido(valor) {
  const cpf = soDigitos(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base) => ((([...base].reduce((total, d, i) => total + Number(d) * (base.length + 1 - i), 0) * 10) % 11) % 10);
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}

function PapeisReferencia() {
  return <section className="section-heading pdi-section-heading" aria-labelledby="papeis-title" style={{ display: 'block', marginTop: 'var(--spacing-scale-5x)' }}>
    <div><h2 id="papeis-title">Papéis e permissões</h2><p className="hint">O que cada papel pode fazer no SUMI. Gestor e Responsável são atribuídos por eixo, na Estrutura de cada plano — aqui é só referência.</p></div>
    <div className="models-grid" style={{ marginTop: 'var(--spacing-scale-3x)' }}>
      {PAPEIS.map((papel) => <article className="model-card" key={papel.nome}>
        <h2>{papel.nome}</h2>
        <p>{papel.resumo}</p>
        <ul className="papel-permissoes-list">{papel.permissoes.map((item) => <li key={item}><Icon name="check" size={13} />{item}</li>)}</ul>
      </article>)}
    </div>
  </section>;
}

// Tela restrita ao Administrador Estratégico (model.manage) — Plano de
// Negócio SUMI, módulo de gerenciamento de usuários. Atribuir alguém como
// Gestor/Responsável de um eixo é feito na Estrutura do planejamento
// (StructureForm em forms.jsx); aqui só se cria/edita/remove a conta.
export function UsersAdmin({ currentUserId }) {
  const [state, setState] = useState({ status: 'loading', usuarios: [] });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reload = () => {
    setState((current) => ({ ...current, status: 'loading' }));
    listarUsuarios()
      .then((usuarios) => setState({ status: 'ready', usuarios }))
      .catch(() => setState({ status: 'error', usuarios: [] }));
  };
  useEffect(reload, []);

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.cpf && !cpfValido(values.cpf)) {
      setError('CPF inválido. Confira os dígitos.');
      return;
    }
    try {
      await criarUsuario({ nome: values.nome.trim(), email: values.email.trim(), senha: values.senha, papelAdmin: values.papelAdmin === 'on', cpf: soDigitos(values.cpf) || undefined });
      setCreating(false);
      reload();
    } catch (err) {
      setError(err.message || 'Não foi possível criar o usuário.');
    }
  }

  async function handleUpdate(event, usuario) {
    event.preventDefault();
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.cpf && !cpfValido(values.cpf)) {
      setError('CPF inválido. Confira os dígitos.');
      return;
    }
    setBusyId(usuario.id);
    try {
      const dados = { nome: values.nome.trim(), papelAdmin: values.papelAdmin === 'on' };
      // Só manda o CPF quando ele mudou; em branco desliga a conta do gov.br.
      if (soDigitos(values.cpf) !== (usuario.cpf || '')) dados.cpf = soDigitos(values.cpf) || null;
      if (values.senha) dados.senha = values.senha;
      await atualizarUsuario(usuario.id, dados);
      setEditingId(null);
      reload();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar as alterações.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(usuario) {
    if (!window.confirm(`Remover o acesso de ${usuario.nome}?`)) return;
    setError('');
    setBusyId(usuario.id);
    try {
      await removerUsuario(usuario.id);
      reload();
    } catch (err) {
      setError(err.message || 'Não foi possível remover o usuário.');
      setBusyId(null);
    }
  }

  const totalUsuarios = state.usuarios.length;
  const totalAdmins = state.usuarios.filter((usuario) => usuario.papelAdmin).length;
  return <div className="page">
    <div className="page-heading">
      <div><p className="eyebrow">CONFIGURAÇÃO</p><h1>Usuários</h1><p>Contas com acesso ao SUMI. A atribuição de Gestor/Responsável por eixo é feita na estrutura de cada planejamento.</p></div>
      {!creating && <Button icon="plus" variant="primary" onClick={() => setCreating(true)}>Novo usuário</Button>}
    </div>
    {state.status === 'ready' && <div className="overview-grid"><article><span>Usuários cadastrados</span><strong>{totalUsuarios}</strong></article><article><span>Administradores</span><strong>{totalAdmins}</strong><small>Acesso total ao sistema</small></article></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {creating && <form className="user-create-form" onSubmit={handleCreate}>
      <div className="form-grid three">
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- formulário revelado pelo clique em "Novo usuário" */}
        <Field label="Nome"><Input name="nome" required maxLength={120} autoFocus /></Field>
        <Field label="E-mail"><Input name="email" type="email" required maxLength={180} /></Field>
        <Field label="Senha provisória"><Input name="senha" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" /></Field>
        <Field label="CPF (opcional)" help="Permite entrar com o gov.br."><Input name="cpf" maxLength={14} placeholder="000.000.000-00" /></Field>
      </div>
      <label className="checkbox-field"><input name="papelAdmin" type="checkbox" /> Administrador Estratégico (acesso total)</label>
      <div className="form-end"><Button onClick={() => { setCreating(false); setError(''); }}>Cancelar</Button><Button type="submit" variant="primary">Criar usuário</Button></div>
    </form>}
    {state.status === 'loading' ? <p className="hint">Carregando usuários…</p>
      : state.status === 'error' ? <Empty title="Não foi possível carregar os usuários" action={<Button onClick={reload}>Tentar novamente</Button>} />
      : !state.usuarios.length ? <Empty title="Nenhum usuário cadastrado" />
      : <div className="table-scroll"><table className="annual-table">
          <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Papel</th><th scope="col">gov.br</th><th scope="col" aria-label="Ações" /></tr></thead>
          <tbody>{state.usuarios.map((usuario) => editingId === usuario.id ? <tr key={usuario.id}><td colSpan={5}>
            <form className="user-edit-form" onSubmit={(event) => handleUpdate(event, usuario)}>
              <div className="form-grid three">
                {/* eslint-disable-next-line jsx-a11y/no-autofocus -- formulário revelado pelo clique em "Editar" */}
                <Field label="Nome"><Input name="nome" required maxLength={120} defaultValue={usuario.nome} autoFocus /></Field>
                <Field label="E-mail"><Input value={usuario.email} disabled /></Field>
                <Field label="Nova senha (opcional)" help="Deixe em branco para manter a atual."><Input name="senha" type="password" minLength={8} /></Field>
                <Field label="CPF" help="Liga a conta ao gov.br. Em branco, desliga."><Input name="cpf" maxLength={14} placeholder="000.000.000-00" defaultValue={formatarCpf(usuario.cpf)} /></Field>
              </div>
              <label className="checkbox-field"><input name="papelAdmin" type="checkbox" defaultChecked={usuario.papelAdmin} /> Administrador Estratégico (acesso total)</label>
              <div className="form-end"><Button onClick={() => { setEditingId(null); setError(''); }}>Cancelar</Button><Button type="submit" variant="primary" disabled={busyId === usuario.id}>Salvar</Button></div>
            </form>
          </td></tr> : <tr key={usuario.id}>
            <td>{usuario.nome}</td>
            <td>{usuario.email}</td>
            <td><Badge tone={usuario.papelAdmin ? 'blue' : 'neutral'}>{usuario.papelAdmin ? 'Administrador' : 'Padrão'}</Badge></td>
            <td className="nowrap">{usuario.cpf ? <Badge tone="green">Vinculado</Badge> : <Badge>Não vinculado</Badge>}</td>
            <td className="table-row-actions">
              <button type="button" className="icon-button" aria-label={`Editar ${usuario.nome}`} onClick={() => setEditingId(usuario.id)}><Icon name="edit" size={15} /></button>
              {usuario.id !== currentUserId && <button type="button" className="icon-button" aria-label={`Remover ${usuario.nome}`} disabled={busyId === usuario.id} onClick={() => handleRemove(usuario)}><Icon name="close" size={15} /></button>}
            </td>
          </tr>)}</tbody>
        </table></div>}
    <PapeisReferencia />
  </div>;
}
