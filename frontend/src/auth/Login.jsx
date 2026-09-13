import { useState } from 'react';
import { Button, Field, Icon } from '../ui.jsx';

const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Tela mínima de login — não existe no protótipo aprovado (que só simulava
// perfis via /__dev/session/*). Sem ela não há como uma sessão autenticada
// real chegar à interface, então foi adicionada como rota aditiva
// (#/login), sem alterar nenhuma tela já aprovada. Ver docs/adr/0005.
export function LoginPage({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Tente novamente.');
        return;
      }
      onSuccess();
    } catch {
      setError('Não foi possível entrar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page login-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACESSO</p>
          <h1>Entrar no SUMI</h1>
          <p>Use as credenciais fornecidas pela SEPLAN.</p>
        </div>
      </div>
      <form className="login-form" onSubmit={submit}>
        <div className="form-body">
          <Field label="E-mail institucional">
            <input type="email" name="email" autoFocus required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Senha">
            <input type="password" name="senha" required autoComplete="current-password" value={senha} onChange={(event) => setSenha(event.target.value)} />
          </Field>
          {error && <p role="alert" className="form-error">{error}</p>}
        </div>
        <div className="form-end">
          <Button type="submit" variant="primary" disabled={loading}>
            <Icon name="user" size={16} />{loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
