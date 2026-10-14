import { Button, Empty, Icon } from './ui.jsx';
import { useTranslation } from './i18n/context.jsx';

// Páginas de erro dedicadas por código — usadas quando uma rota não existe
// (404), a sessão não tem permissão para o recurso (403), não há sessão
// válida para uma ação que exige uma (401), o servidor falhou (500) ou a
// API não respondeu (falha de conexão). Reaproveitam os componentes visuais
// já aprovados (Empty/Button/Icon), não criam um sistema visual novo.
function presets(t) {
  return {
    404: { icon: 'search', eyebrow: t('errors.notFoundEyebrow'), title: t('errors.notFoundTitle'), description: t('errors.notFoundText') },
    403: { icon: 'info', eyebrow: t('errors.forbiddenEyebrow'), title: t('errors.forbiddenTitle'), description: t('errors.forbiddenText') },
    401: { icon: 'user', eyebrow: t('errors.unauthorizedEyebrow'), title: t('errors.unauthorizedTitle'), description: t('errors.unauthorizedText') },
    500: { icon: 'info', eyebrow: t('errors.serverEyebrow'), title: t('errors.serverTitle'), description: t('errors.serverText') },
    offline: { icon: 'link', eyebrow: t('errors.offlineEyebrow'), title: t('errors.offlineTitle'), description: t('errors.offlineText') },
  };
}

export function ErrorPage({ code, description, action, secondaryAction }) {
  const { t } = useTranslation();
  const preset = presets(t)[code] || presets(t)[500];
  return (
    <div className="page error-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{preset.eyebrow}</p>
          <h1><Icon name={preset.icon} size={22} />{preset.title}</h1>
          <p>{description || preset.description}</p>
        </div>
      </div>
      <Empty title={typeof code === 'number' ? t('errors.errorLabel', { code }) : t('errors.errorLabel', { code: '' }).trim()} action={action}>
        {secondaryAction}
      </Empty>
    </div>
  );
}

export function NotFoundPage({ onGoHome }) {
  const { t } = useTranslation();
  return <ErrorPage code={404} action={<Button variant="primary" onClick={onGoHome}>{t('errors.backHome')}</Button>} />;
}

export function ForbiddenPage({ onGoHome }) {
  const { t } = useTranslation();
  return <ErrorPage code={403} action={<Button variant="primary" onClick={onGoHome}>{t('errors.backHome')}</Button>} />;
}

export function UnauthorizedPage({ onLogin }) {
  const { t } = useTranslation();
  return <ErrorPage code={401} action={<Button variant="primary" onClick={onLogin}>{t('errors.signIn')}</Button>} />;
}

export function ServerErrorPage({ onRetry }) {
  const { t } = useTranslation();
  return <ErrorPage code={500} action={<Button variant="primary" onClick={onRetry}>{t('errors.retry')}</Button>} />;
}

export function OfflinePage({ onRetry }) {
  const { t } = useTranslation();
  return <ErrorPage code="offline" action={<Button variant="primary" onClick={onRetry}>{t('errors.retry')}</Button>} />;
}
