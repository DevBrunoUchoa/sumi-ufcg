import { useState } from 'react';
import { Button, Field, Icon } from '../ui.jsx';
import { useTranslation } from '../i18n/context.jsx';

const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');
// The server must implement the OIDC authorization/callback flow before enabling it.
const GOVBR_ENABLED = env.VITE_GOVBR_LOGIN_ENABLED === 'true';

// Uses the existing SUMI credentials until an identity provider is integrated.
// A GOV.BR sign-in must target the backend authorization route, not collect its password.
export function LoginPage({ onSuccess, authenticated = false, returnTo = '/inicio' }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? t('login.errorInvalid') : t('login.errorGeneric'));
        return;
      }
      await onSuccess();
    } catch {
      setError(t('login.errorOffline'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="access-layout">
      {authenticated ? <section className="br-card login-form"><div className="form-body"><h1>{t('login.sessionActiveTitle')}</h1><p>{t('login.sessionActiveText')}</p><a className="br-button primary" href={`#${returnTo}`}>{t('login.continue')} <Icon name="arrow" size={16} /></a></div></section> :
      <form className="login-form" onSubmit={submit}>
        <div className="form-body">
          {GOVBR_ENABLED && <a className="br-sign-in primary block" href={`${API_BASE_URL}/api/v1/auth/govbr/authorize?${new URLSearchParams({ returnTo })}`}><Icon name="user" size={16} />{t('login.govbrSignIn')} <strong>GOV.BR</strong></a>}
          <h1>{t('login.title')}</h1>
          <p>{t('login.lead')}</p>
          <Field label={t('login.emailLabel')}>
            <input type="email" name="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <div className="field"><label htmlFor="login-password">{t('login.passwordLabel')}</label><div className="login-password"><input id="login-password" type={showPassword ? 'text' : 'password'} name="senha" required autoComplete="current-password" disabled={loading} value={senha} onChange={(event) => setSenha(event.target.value)} /><button className="br-button circle" type="button" aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={16} /></button></div></div>
          <a className="login-forgot-password" href="#/esqueci-senha">{t('login.forgotPassword')}</a>
          {error && <p role="alert" className="form-error">{error}</p>}
        </div>
        <div className="form-end">
          <Button type="submit" variant="primary" block disabled={loading}>
            <Icon name="user" size={16} />{loading ? t('login.signingIn') : t('login.signIn')}
          </Button>
        </div>
      </form>
      }
      {!authenticated && <div className="access-public-info"><strong>{t('login.publicOnlyTitle')}</strong><p>{t('login.publicOnlyText')}</p><a href="#/planejamentos">{t('login.publicOnlyLink')} <Icon name="arrow" size={14} /></a></div>}
    </div>
  );
}
