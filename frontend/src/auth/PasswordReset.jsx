import { useState } from 'react';
import { Button, Field, Icon } from '../ui.jsx';
import { redefinirSenha, solicitarRedefinicaoSenha } from './password-reset-client.js';

// Pede o e-mail e dispara o link de redefinição — a resposta é sempre a
// mesma (sucesso), exista ou não o e-mail, pra não virar uma forma de
// descobrir quem tem conta no SUMI (ver authService.solicitarRedefinicaoSenha
// no backend).
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await solicitarRedefinicaoSenha(email);
      setSent(true);
    } catch {
      setError('Não foi possível concluir o pedido. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-layout">
      {sent ? (
        <section className="br-card login-form"><div className="form-body">
          <h1>Confira seu e-mail</h1>
          <p>Se <strong>{email}</strong> tiver uma conta no SUMI, enviamos um link para redefinir a senha. O link expira em 1 hora.</p>
          <a className="br-button primary" href="#/login">Voltar ao acesso <Icon name="arrow" size={16} /></a>
        </div></section>
      ) : (
        <form className="login-form" onSubmit={submit}>
          <div className="form-body">
            <h1>Esqueci minha senha</h1>
            <p>Informe o e-mail institucional da sua conta. Enviaremos um link para você criar uma nova senha.</p>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- único campo do formulário */}
            <Field label="E-mail institucional"><input type="email" required autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            {error && <p role="alert" className="form-error">{error}</p>}
          </div>
          <div className="form-end">
            <Button type="submit" variant="primary" block disabled={loading}>{loading ? 'Enviando…' : 'Enviar link de redefinição'}</Button>
          </div>
        </form>
      )}
      <div className="access-public-info"><a href="#/login"><Icon name="arrow" size={14} />Voltar ao acesso</a></div>
    </div>
  );
}

// Define a nova senha a partir do token no link enviado por e-mail.
export function ResetPasswordPage({ token }) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (senha.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirmacao) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      await redefinirSenha(token, senha);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <div className="access-layout"><section className="br-card login-form"><div className="form-body">
      <h1>Link inválido</h1>
      <p>Este link de redefinição de senha está incompleto. Solicite um novo.</p>
      <a className="br-button primary" href="#/esqueci-senha">Solicitar novo link <Icon name="arrow" size={16} /></a>
    </div></section></div>;
  }

  return (
    <div className="access-layout">
      {done ? (
        <section className="br-card login-form"><div className="form-body">
          <h1>Senha redefinida</h1>
          <p>Sua senha foi alterada. Você já pode entrar com a nova senha.</p>
          <a className="br-button primary" href="#/login">Ir para o acesso <Icon name="arrow" size={16} /></a>
        </div></section>
      ) : (
        <form className="login-form" onSubmit={submit}>
          <div className="form-body">
            <h1>Criar nova senha</h1>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- primeiro campo do formulário */}
            <Field label="Nova senha" help="Mínimo de 8 caracteres."><input type="password" required minLength={8} autoFocus autoComplete="new-password" disabled={loading} value={senha} onChange={(event) => setSenha(event.target.value)} /></Field>
            <Field label="Confirme a nova senha"><input type="password" required minLength={8} autoComplete="new-password" disabled={loading} value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} /></Field>
            {error && <p role="alert" className="form-error">{error}</p>}
          </div>
          <div className="form-end">
            <Button type="submit" variant="primary" block disabled={loading}>{loading ? 'Salvando…' : 'Redefinir senha'}</Button>
          </div>
        </form>
      )}
      <div className="access-public-info"><a href="#/login"><Icon name="arrow" size={14} />Voltar ao acesso</a></div>
    </div>
  );
}
