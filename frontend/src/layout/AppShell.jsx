import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui.jsx';
import { breadcrumbsFor } from './breadcrumbs.js';
import { loginUrl } from '../auth/navigation.js';

function Brand() {
  return <a className="sumi-brand" href="#/inicio" aria-label="SUMI início"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>SUMI<small>Sistema Unificado de Monitoramento Institucional</small></span></a>;
}

function Footer({ inert = false, work = false }) {
  if (work) return <footer className="sumi-work-footer" id="footer" aria-label="Rodapé" inert={inert}><div className="sumi-container"><span>SUMI</span><nav aria-label="Links do rodapé"><a href="#/ajuda">Ajuda</a><a href="#/privacidade">Privacidade</a></nav></div></footer>;
  return (
    <footer className="br-footer sumi-footer" id="footer" aria-label="Rodapé" inert={inert}>
      <div className="sumi-container">
        <div className="sumi-footer-main">
          <div>
            <strong>SUMI</strong>
            <p>Sistema Unificado de Monitoramento Institucional</p>
            <p>Consulta pública e acompanhamento dos planos institucionais.</p>
          </div>
          <nav aria-label="Links do rodapé">
            <a href="#/sobre">Sobre o SUMI</a>
            <a href="#/ajuda">Ajuda e acessibilidade</a>
            <a href="#/privacidade">Informações sobre privacidade</a>
          </nav>
        </div>
        <div className="sumi-footer-bottom">
          <a href="https://www.gov.br" aria-label="Portal GOV.BR">
            <img src="/images/govbr-negative.png" alt="gov.br" width="120" height="44" />
          </a>
          <span>Planos, ações e resultados em um único lugar.</span>
        </div>
      </div>
    </footer>
  );
}

export function AppShell({ route, plan, session, mode, links = [], altoContraste, darkMode, vlibrasAtivo, toggleAltoContraste, toggleDarkMode, toggleVlibras, onLogout, children, loading = false }) {
  const [menuOpen, setMenuOpen] = useState(() => window.matchMedia('(min-width: 992px)').matches);
  const [logoutState, setLogoutState] = useState('idle');
  const menuButton = useRef(null);
  const closeButton = useRef(null);
  const accessibilityMenu = useRef(null);
  const menu = useRef(null);
  const previousRoute = useRef('');
  const returnMenuFocus = useRef(false);
  const crumbs = mode === 'public' && !plan ? [] : breadcrumbsFor(route, plan);
  const work = mode === 'work';
  const mobileMenuOpen = work && menuOpen && !window.matchMedia('(min-width: 992px)').matches;
  const locationKey = `${route.path}|${['item', 'action', 'stage', 'view', 'tab', 'objective'].map((key) => route.query.get(key)).join('|')}`;
  const closeMenu = () => { returnMenuFocus.current = true; setMenuOpen(false); };
  useEffect(() => {
    if (!mobileMenuOpen && returnMenuFocus.current) {
      returnMenuFocus.current = false;
      menuButton.current?.focus();
    }
  }, [mobileMenuOpen]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 992px)');
    const resize = () => setMenuOpen(media.matches);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    const closeAccessibility = (event) => {
      const details = accessibilityMenu.current;
      if (!details?.open) return;
      if (event.type === 'keydown' && event.key === 'Escape') { details.open = false; details.querySelector('summary').focus(); }
      if (event.type === 'pointerdown' && !details.contains(event.target)) details.open = false;
    };
    document.addEventListener('keydown', closeAccessibility);
    document.addEventListener('pointerdown', closeAccessibility);
    return () => { document.removeEventListener('keydown', closeAccessibility); document.removeEventListener('pointerdown', closeAccessibility); };
  }, []);
  useEffect(() => {
    if (loading || previousRoute.current === locationKey) return;
    // Release the modal menu before focusing content, which is inert while open.
    if (mobileMenuOpen) { setMenuOpen(false); return; }
    const initial = !previousRoute.current;
    previousRoute.current = locationKey;
    if (!window.matchMedia('(min-width: 992px)').matches) setMenuOpen(false);
    if (accessibilityMenu.current) accessibilityMenu.current.open = false;
    if (!initial) {
      window.scrollTo(0, 0);
      const heading = document.querySelector('#main-content h1');
      const target = heading || document.getElementById('main-content');
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
    }
  }, [locationKey, loading, mobileMenuOpen]);
  useEffect(() => {
    if (!work || !menuOpen || window.matchMedia('(min-width: 992px)').matches) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const keyboard = (event) => {
      if (event.key === 'Escape') { returnMenuFocus.current = true; setMenuOpen(false); }
      if (event.key === 'Tab') {
        const controls = [...menu.current.querySelectorAll('a[href], button')];
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = priorOverflow; document.removeEventListener('keydown', keyboard); };
  }, [work, menuOpen]);
  async function leave() {
    setLogoutState('loading');
    try { await onLogout(); setLogoutState('idle'); } catch { setLogoutState('error'); }
  }
  return (
    <div className={`template-base sumi-shell sumi-${mode} ${work && menuOpen ? 'menu-open' : ''}`}>
      <nav className="sumi-skiplinks" aria-label="Acesso rápido" inert={mobileMenuOpen}>
        <a href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Ir para o conteúdo</a>
        <a href="#footer" onClick={(event) => { event.preventDefault(); const footer = document.getElementById('footer'); footer.tabIndex = -1; footer.focus(); }}>Ir para o rodapé</a>
      </nav>
      <header className="br-header compact sumi-header" inert={mobileMenuOpen}>
        <div className="sumi-container">
          <div className="header-top">
            <div className="header-logo">
              {work && <button ref={menuButton} className="br-button circle small" type="button" aria-label={menuOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>}
              <Brand />
            </div>
            <div className="header-actions">
              <details className="sumi-accessibility" ref={accessibilityMenu}>
                <summary className="br-button small" aria-label="Acessibilidade"><Icon name="accessibility" /><span>Acessibilidade</span></summary>
                <div className="sumi-accessibility-panel">
                  <strong>Recursos de acessibilidade</strong>
                  <button type="button" className="br-button tertiary small" aria-pressed={darkMode} onClick={toggleDarkMode}><Icon name={darkMode ? 'sun' : 'moon'} />{darkMode ? 'Tema claro' : 'Tema escuro'}</button>
                  <button type="button" className="br-button tertiary small" aria-pressed={altoContraste} onClick={toggleAltoContraste}><Icon name="contrast" />{altoContraste ? 'Contraste padrão' : 'Alto contraste'}</button>
                  <button type="button" className="br-button tertiary small" aria-pressed={vlibrasAtivo} onClick={toggleVlibras}><Icon name="libras" />{vlibrasAtivo ? 'Desativar Libras' : 'Ativar Libras'}</button>
                  <a href="#/ajuda">Ajuda para navegar</a>
                </div>
              </details>
              {session.authenticated ? (
                <div className="account-summary">
                  <span className="account-avatar" aria-hidden="true"><Icon name="user" size={16} /></span>
                  <div className="account-identity">
                    <strong>{session.user.name}</strong>
                    <small>{session.roles.map((role) => role.name).join(' · ')}</small>
                  </div>
                  <button type="button" className="br-button tertiary small" disabled={logoutState === 'loading'} onClick={leave}>{logoutState === 'loading' ? 'Saindo…' : 'Sair'}</button>
                </div>
              ) : mode !== 'access' && <a className="br-sign-in small" href={`#${loginUrl(route)}`}><Icon name="user" size={16} /><span>Entrar</span></a>}
            </div>
          </div>
          {!work && mode !== 'access' && (
            <nav className="sumi-public-nav" aria-label="Navegação principal">
              {[['/inicio', 'Início'], ['/planejamentos', 'Planos'], ['/sobre', 'Sobre o SUMI']].map(([path, label]) => (
                <a key={path} href={`#${path}`} aria-current={route.path === path || (path === '/planejamentos' && plan) ? 'page' : undefined}>{label}</a>
              ))}
            </nav>
          )}
        </div>
      </header>
      {logoutState === 'error' && <p role="alert" className="sumi-session-error">Não foi possível sair. Tente novamente.</p>}
      <div className="sumi-body">
        {work && menuOpen && <>
          <button className="sumi-menu-backdrop" aria-label="Fechar menu" tabIndex={-1} onClick={closeMenu} />
          <aside className="br-menu push active sumi-menu" id="main-navigation" ref={menu} role={mobileMenuOpen ? 'dialog' : undefined} aria-modal={mobileMenuOpen ? 'true' : undefined} aria-label={mobileMenuOpen ? 'Menu da área de trabalho' : undefined}>
            <div className="menu-container">
              <div className="menu-panel">
                <div className="menu-header">
                  <span className="menu-title">Área de trabalho</span>
                  <button ref={closeButton} type="button" className="br-button circle small" aria-label="Fechar menu lateral" onClick={closeMenu}><Icon name="close" /></button>
                </div>
                <nav className="menu-body" aria-label="Navegação principal">
                  {links.map(({ path, icon, text }) => (
                    <a key={path} className={`menu-item ${route.path === path || (path === '/planejamentos' && plan) ? 'active' : ''}`} aria-current={route.path === path || (path === '/planejamentos' && plan) ? 'page' : undefined} href={`#${path}`}>
                      <span className="icon"><Icon name={icon} /></span><span className="content">{text}</span>
                    </a>
                  ))}
                </nav>
                <div className="menu-footer"><a href="#/ajuda">Ajuda e orientações</a></div>
              </div>
            </div>
          </aside>
        </>}
        <main id="main-content" tabIndex={-1} aria-busy={loading} inert={mobileMenuOpen}>
          <div className="sumi-content">
            {!!crumbs.length && (
              <nav className="br-breadcrumb planning-breadcrumb" aria-label={plan ? 'Hierarquia do planejamento' : 'Localização'}>
                <ol className="crumb-list">
                  {crumbs.map((entry, index) => (
                    <li className="crumb" key={`${entry.label}-${index}`}>
                      {index > 0 && <Icon name="chevron" size={12} aria-hidden="true" />}
                      {index === crumbs.length - 1 || !entry.url ? <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{entry.label}</span> : <a href={`#${entry.url}`}>{entry.label}</a>}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {children}
          </div>
        </main>
      </div>
      <Footer inert={mobileMenuOpen} work={work} />
    </div>
  );
}
