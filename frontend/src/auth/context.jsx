import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createSessionClient } from './session-client.js';
import { can as checkPermission } from './permissions.js';

const SessionContext = createContext(null);
const defaultClient = createSessionClient();

export function SessionProvider({ children, client = defaultClient }) {
  const [state, setState] = useState({ status: 'loading', session: null, error: null });

  const reload = useCallback(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: null }));
    client.load({ signal: controller.signal })
      .then((session) => setState({ status: 'ready', session, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', session: null, error }); });
    return () => controller.abort();
  }, [client]);

  useEffect(() => reload(), [reload]);
  const value = useMemo(() => ({ ...state, reload, can: (permission, resource) => checkPermission(state.session, permission, resource) }), [state, reload]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession precisa estar dentro de SessionProvider.');
  return value;
}
