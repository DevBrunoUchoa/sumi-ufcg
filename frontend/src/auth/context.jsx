import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createSessionClient } from './session-client.js';
import { can as checkPermission } from './permissions.js';

const SessionContext = createContext(null);
const defaultClient = createSessionClient();

export function SessionProvider({ children, client = defaultClient }) {
  const [state, setState] = useState({ status: 'loading', session: null, error: null });
  const currentRequest = useRef(null);

  const reload = useCallback(async () => {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const session = await client.load({ signal: controller.signal });
      if (!controller.signal.aborted) setState({ status: 'ready', session, error: null });
      return session;
    } catch (error) {
      if (error.name !== 'AbortError') setState({ status: 'error', session: null, error });
      throw error;
    }
  }, [client]);

  useEffect(() => { reload().catch(() => {}); return () => currentRequest.current?.abort(); }, [reload]);
  const value = useMemo(() => ({ ...state, reload, can: (permission, resource) => checkPermission(state.session, permission, resource) }), [state, reload]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession precisa estar dentro de SessionProvider.');
  return value;
}
