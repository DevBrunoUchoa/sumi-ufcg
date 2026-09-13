import { Button, Empty, Icon } from './ui.jsx';

// Páginas de erro dedicadas por código — usadas quando uma rota não existe
// (404), a sessão não tem permissão para o recurso (403), não há sessão
// válida para uma ação que exige uma (401), o servidor falhou (500) ou a
// API não respondeu (falha de conexão). Reaproveitam os componentes visuais
// já aprovados (Empty/Button/Icon), não criam um sistema visual novo.
const PRESETS = Object.freeze({
  404: {
    icon: 'search',
    eyebrow: 'PÁGINA NÃO ENCONTRADA',
    title: 'Não encontramos essa página',
    description: 'O endereço acessado não existe ou não está disponível para a sua sessão.',
  },
  403: {
    icon: 'info',
    eyebrow: 'ACESSO NÃO AUTORIZADO',
    title: 'Você não tem acesso a esta página',
    description: 'Sua sessão não possui a permissão necessária para ver este conteúdo.',
  },
  401: {
    icon: 'user',
    eyebrow: 'SESSÃO NECESSÁRIA',
    title: 'Entre para continuar',
    description: 'Esta ação exige uma sessão institucional autenticada.',
  },
  500: {
    icon: 'info',
    eyebrow: 'ERRO INTERNO',
    title: 'Algo deu errado do nosso lado',
    description: 'Não foi possível concluir a operação. Tente novamente em instantes.',
  },
  offline: {
    icon: 'link',
    eyebrow: 'SEM CONEXÃO',
    title: 'Não foi possível falar com o servidor',
    description: 'Verifique sua conexão com a internet e tente novamente.',
  },
});

export function ErrorPage({ code, description, action, secondaryAction }) {
  const preset = PRESETS[code] || PRESETS[500];
  return (
    <div className="page error-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{preset.eyebrow}</p>
          <h1><Icon name={preset.icon} size={22} />{preset.title}</h1>
          <p>{description || preset.description}</p>
        </div>
      </div>
      <Empty title={`Erro ${typeof code === 'number' ? code : ''}`.trim()} action={action}>
        {secondaryAction}
      </Empty>
    </div>
  );
}

export function NotFoundPage({ onGoHome }) {
  return <ErrorPage code={404} action={<Button variant="primary" onClick={onGoHome}>Voltar ao início</Button>} />;
}

export function ForbiddenPage({ onGoHome }) {
  return <ErrorPage code={403} action={<Button variant="primary" onClick={onGoHome}>Voltar ao início</Button>} />;
}

export function UnauthorizedPage({ onLogin }) {
  return <ErrorPage code={401} action={<Button variant="primary" onClick={onLogin}>Entrar</Button>} />;
}

export function ServerErrorPage({ onRetry }) {
  return <ErrorPage code={500} action={<Button variant="primary" onClick={onRetry}>Tentar novamente</Button>} />;
}

export function OfflinePage({ onRetry }) {
  return <ErrorPage code="offline" action={<Button variant="primary" onClick={onRetry}>Tentar novamente</Button>} />;
}
