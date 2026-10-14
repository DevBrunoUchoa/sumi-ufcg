import { useState } from 'react';
import { Button, Field, Icon } from '../ui.jsx';
import { redefinirSenha, solicitarRedefinicaoSenha } from './password-reset-client.js';
import { useTranslation } from '../i18n/context.jsx';

// Pede o e-mail e dispara o link de redefinição — a resposta é sempre a
// mesma (sucesso), exista ou não o e-mail, pra não virar uma forma de
// descobrir quem tem conta no SUMI (ver authService.solicitarRedefinicaoSenha
// no backend).
export function ForgotPasswordPage() {
  const { t } = useTranslation();
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
      setError(t('forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-layout">
      {sent ? (
        <section className="br-card login-form"><div className="form-body">
          <h1>{t('forgotPassword.sentTitle')}</h1>
          <p>{t('forgotPassword.sentTextBefore')}<strong>{email}</strong>{t('forgotPassword.sentTextAfter')}</p>
          <a className="br-button primary" href="#/login">{t('forgotPassword.backToLogin')} <Icon name="arrow" size={16} /></a>
        </div></section>
      ) : (
        <form className="login-form" onSubmit={submit}>
          <div className="form-body">
            <h1>{t('forgotPassword.title')}</h1>
            <p>{t('forgotPassword.lead')}</p>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- único campo do formulário */}
            <Field label={t('login.emailLabel')}><input type="email" required autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            {error && <p role="alert" className="form-error">{error}</p>}
          </div>
          <div className="form-end">
            <Button type="submit" variant="primary" block disabled={loading}>{loading ? t('forgotPassword.sending') : t('forgotPassword.submit')}</Button>
          </div>
        </form>
      )}
      <div className="access-public-info"><a href="#/login"><Icon name="arrow" size={14} />{t('forgotPassword.backToLogin')}</a></div>
    </div>
  );
}

// Define a nova senha a partir do token no link enviado por e-mail.
export function ResetPasswordPage({ token }) {
  const { t } = useTranslation();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (senha.length < 8) { setError(t('resetPassword.errorLength')); return; }
    if (senha !== confirmacao) { setError(t('resetPassword.errorMismatch')); return; }
    setLoading(true);
    try {
      await redefinirSenha(token, senha);
      setDone(true);
    } catch (err) {
      setError(err.message || t('resetPassword.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <div className="access-layout"><section className="br-card login-form"><div className="form-body">
      <h1>{t('resetPassword.invalidTitle')}</h1>
      <p>{t('resetPassword.invalidText')}</p>
      <a className="br-button primary" href="#/esqueci-senha">{t('resetPassword.requestNewLink')} <Icon name="arrow" size={16} /></a>
    </div></section></div>;
  }

  return (
    <div className="access-layout">
      {done ? (
        <section className="br-card login-form"><div className="form-body">
          <h1>{t('resetPassword.doneTitle')}</h1>
          <p>{t('resetPassword.doneText')}</p>
          <a className="br-button primary" href="#/login">{t('resetPassword.goToLogin')} <Icon name="arrow" size={16} /></a>
        </div></section>
      ) : (
        <form className="login-form" onSubmit={submit}>
          <div className="form-body">
            <h1>{t('resetPassword.title')}</h1>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- primeiro campo do formulário */}
            <Field label={t('resetPassword.newPasswordLabel')} help={t('resetPassword.newPasswordHelp')}><input type="password" required minLength={8} autoFocus autoComplete="new-password" disabled={loading} value={senha} onChange={(event) => setSenha(event.target.value)} /></Field>
            <Field label={t('resetPassword.confirmPasswordLabel')}><input type="password" required minLength={8} autoComplete="new-password" disabled={loading} value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} /></Field>
            {error && <p role="alert" className="form-error">{error}</p>}
          </div>
          <div className="form-end">
            <Button type="submit" variant="primary" block disabled={loading}>{loading ? t('resetPassword.saving') : t('resetPassword.submit')}</Button>
          </div>
        </form>
      )}
      <div className="access-public-info"><a href="#/login"><Icon name="arrow" size={14} />{t('forgotPassword.backToLogin')}</a></div>
    </div>
  );
}
