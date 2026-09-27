import { useEffect, useState } from 'react';
import { Badge, Button, Empty, Field, Icon, Input } from './ui.jsx';
import { atualizarUsuario, criarUsuario, listarUsuarios, removerUsuario } from './admin-client.js';

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
    try {
      await criarUsuario({ nome: values.nome.trim(), email: values.email.trim(), senha: values.senha, papelAdmin: values.papelAdmin === 'on' });
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
    setBusyId(usuario.id);
    try {
      const dados = { nome: values.nome.trim(), papelAdmin: values.papelAdmin === 'on' };
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

  return <div className="page">
    <div className="page-heading">
      <div><p className="eyebrow">CONFIGURAÇÃO</p><h1>Usuários</h1><p>Contas com acesso ao SUMI. A atribuição de Gestor/Responsável por eixo é feita na estrutura de cada planejamento.</p></div>
      {!creating && <Button icon="plus" variant="primary" onClick={() => setCreating(true)}>Novo usuário</Button>}
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {creating && <form className="user-create-form" onSubmit={handleCreate}>
      <div className="form-grid three">
        <Field label="Nome"><Input name="nome" required maxLength={120} autoFocus /></Field>
        <Field label="E-mail"><Input name="email" type="email" required maxLength={180} /></Field>
        <Field label="Senha provisória"><Input name="senha" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" /></Field>
      </div>
      <label className="checkbox-field"><input name="papelAdmin" type="checkbox" /> Administrador Estratégico (acesso total)</label>
      <div className="form-end"><Button onClick={() => { setCreating(false); setError(''); }}>Cancelar</Button><Button type="submit" variant="primary">Criar usuário</Button></div>
    </form>}
    {state.status === 'loading' ? <p className="hint">Carregando usuários…</p>
      : state.status === 'error' ? <Empty title="Não foi possível carregar os usuários" action={<Button onClick={reload}>Tentar novamente</Button>} />
      : !state.usuarios.length ? <Empty title="Nenhum usuário cadastrado" />
      : <div className="table-scroll"><table className="annual-table">
          <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Papel</th><th scope="col" aria-label="Ações" /></tr></thead>
          <tbody>{state.usuarios.map((usuario) => editingId === usuario.id ? <tr key={usuario.id}><td colSpan={4}>
            <form className="user-edit-form" onSubmit={(event) => handleUpdate(event, usuario)}>
              <div className="form-grid three">
                <Field label="Nome"><Input name="nome" required maxLength={120} defaultValue={usuario.nome} autoFocus /></Field>
                <Field label="E-mail"><Input value={usuario.email} disabled /></Field>
                <Field label="Nova senha (opcional)" help="Deixe em branco para manter a atual."><Input name="senha" type="password" minLength={8} /></Field>
              </div>
              <label className="checkbox-field"><input name="papelAdmin" type="checkbox" defaultChecked={usuario.papelAdmin} /> Administrador Estratégico (acesso total)</label>
              <div className="form-end"><Button onClick={() => { setEditingId(null); setError(''); }}>Cancelar</Button><Button type="submit" variant="primary" disabled={busyId === usuario.id}>Salvar</Button></div>
            </form>
          </td></tr> : <tr key={usuario.id}>
            <td>{usuario.nome}</td>
            <td>{usuario.email}</td>
            <td><Badge tone={usuario.papelAdmin ? 'blue' : 'neutral'}>{usuario.papelAdmin ? 'Administrador' : 'Padrão'}</Badge></td>
            <td className="table-row-actions">
              <button type="button" className="icon-button" aria-label={`Editar ${usuario.nome}`} onClick={() => setEditingId(usuario.id)}><Icon name="edit" size={15} /></button>
              {usuario.id !== currentUserId && <button type="button" className="icon-button" aria-label={`Remover ${usuario.nome}`} disabled={busyId === usuario.id} onClick={() => handleRemove(usuario)}><Icon name="close" size={15} /></button>}
            </td>
          </tr>)}</tbody>
        </table></div>}
  </div>;
}
