import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui.jsx';
import { breadcrumbsFor } from './breadcrumbs.js';
import { loginUrl } from '../auth/navigation.js';
import { isDashboardRoute } from '../planning/navigation.js';
import { useTranslation } from '../i18n/context.jsx';
import { LanguageSelector } from '../i18n/LanguageSelector.jsx';

function Brand({ t }) {
  return <a className="sumi-brand" href="#/inicio" aria-label="SUMI início"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>SUMI<small>{t('shell.tagline')}</small></span></a>;
}

function OrgBar({ t }) {
  return (
    <div className="sumi-org-bar">
      <div className="sumi-container">
        <a href="https://www.ufcg.edu.br/" target="_blank" rel="noopener noreferrer">{t('shell.orgBar.ufcg')}</a>
        <span aria-hidden="true">·</span>
        <a href="https://www.gov.br/" target="_blank" rel="noopener noreferrer">{t('shell.orgBar.govbr')}</a>
        <LanguageSelector className="sumi-org-bar-language" />
      </div>
    </div>
  );
}

function CidadaoLinks({ className, t }) {
  return (
    <nav className={className} aria-label={t('shell.footer.citizenAria')}>
      <a href="https://falabr.cgu.gov.br/" target="_blank" rel="noopener noreferrer">{t('shell.footer.ombudsman')}</a>
      <a href="https://falabr.cgu.gov.br/" target="_blank" rel="noopener noreferrer">{t('shell.footer.esic')}</a>
      <a href="https://www.ufcg.edu.br/" target="_blank" rel="noopener noreferrer">{t('shell.footer.accessToInfo')}</a>
    </nav>
  );
}

function Footer({ inert = false, work = false, t }) {
  if (work) return (
    <footer className="sumi-work-footer" id="footer" aria-label={t('shell.footer.ariaLabel')} inert={inert}>
      <div className="sumi-container">
        <span>SUMI</span>
        <nav aria-label={t('shell.footer.linksAria')}><a href="#/ajuda">{t('shell.footer.workHelp')}</a><a href="#/privacidade">{t('shell.footer.workPrivacy')}</a></nav>
        <CidadaoLinks className="sumi-work-footer-cidadao" t={t} />
      </div>
    </footer>
  );
  return (
    <footer className="br-footer sumi-footer" id="footer" aria-label={t('shell.footer.ariaLabel')} inert={inert}>
      <div className="sumi-container">
        <div className="sumi-footer-main">
          <div>
            <strong>SUMI</strong>
            <p>{t('shell.footer.tagline')}</p>
            <p>{t('shell.footer.description')}</p>
          </div>
          <nav aria-label={t('shell.footer.linksAria')}>
            <a href="#/sobre">{t('shell.footer.about')}</a>
            <a href="#/ajuda">{t('shell.footer.help')}</a>
            <a href="#/privacidade">{t('shell.footer.privacy')}</a>
          </nav>
          <CidadaoLinks t={t} />
        </div>
        <div className="sumi-footer-bottom">
          <a href="https://www.gov.br" aria-label={t('shell.footer.govbrAria')}>
            <img src="/images/govbr-negative.png" alt="gov.br" width="120" height="44" />
          </a>
          <span>{t('shell.footer.bottomTagline')}</span>
        </div>
      </div>
    </footer>
  );
}

export function AppShell({ route, plan, session, mode, links = [], altoContraste, darkMode, vlibrasAtivo, toggleAltoContraste, toggleDarkMode, toggleVlibras, onLogout, children, loading = false }) {
  const { t } = useTranslation();
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
  const locationKey = isDashboardRoute(route) ? route.path : `${route.path}|${['item', 'action', 'stage', 'view', 'tab', 'objective'].map((key) => route.query.get(key)).join('|')}`;
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
      <nav className="sumi-skiplinks" aria-label={t('shell.skip.ariaLabel')} inert={mobileMenuOpen}>
        <a href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>{t('shell.skip.content')}</a>
        <a href="#footer" onClick={(event) => { event.preventDefault(); const footer = document.getElementById('footer'); footer.tabIndex = -1; footer.focus(); }}>{t('shell.skip.footer')}</a>
      </nav>
      <OrgBar t={t} />
      <header className="br-header compact sumi-header" inert={mobileMenuOpen}>
        <div className="sumi-container">
          <div className="header-top">
            <div className="header-logo">
              {work && <button ref={menuButton} className="br-button circle small" type="button" aria-label={menuOpen ? t('shell.menu.collapse') : t('shell.menu.expand')} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>}
              <Brand t={t} />
            </div>
            <div className="header-actions">
              <details className="sumi-accessibility" ref={accessibilityMenu}>
                <summary className="br-button small" aria-label={t('shell.accessibility.button')}><Icon name="accessibility" /><span>{t('shell.accessibility.button')}</span></summary>
                <div className="sumi-accessibility-panel">
                  <strong>{t('shell.accessibility.heading')}</strong>
                  <button type="button" className="br-button tertiary small" aria-pressed={darkMode} onClick={toggleDarkMode}><Icon name={darkMode ? 'sun' : 'moon'} />{darkMode ? t('shell.accessibility.lightTheme') : t('shell.accessibility.darkTheme')}</button>
                  <button type="button" className="br-button tertiary small" aria-pressed={altoContraste} onClick={toggleAltoContraste}><Icon name="contrast" />{altoContraste ? t('shell.accessibility.contrastDefault') : t('shell.accessibility.contrastHigh')}</button>
                  <button type="button" className="br-button tertiary small" aria-pressed={vlibrasAtivo} onClick={toggleVlibras}><Icon name="libras" />{vlibrasAtivo ? t('shell.accessibility.librasOff') : t('shell.accessibility.librasOn')}</button>
                  <a href="#/ajuda">{t('shell.accessibility.helpLink')}</a>
                </div>
              </details>
              {session.authenticated ? (
                <div className="account-summary">
                  <span className="account-avatar" aria-hidden="true"><Icon name="user" size={16} /></span>
                  <div className="account-identity">
                    <strong>{session.user.name}</strong>
                    <small>{session.roles.map((role) => role.name).join(' · ')}</small>
                  </div>
                  <button type="button" className="br-button tertiary small" disabled={logoutState === 'loading'} onClick={leave}>{logoutState === 'loading' ? t('shell.account.signingOut') : t('shell.account.signOut')}</button>
                </div>
              ) : mode !== 'access' && <a className="br-sign-in small" href={`#${loginUrl(route)}`}><Icon name="user" size={16} /><span>{t('shell.account.signIn')}</span></a>}
            </div>
          </div>
          {!work && mode !== 'access' && (
            <nav className="sumi-public-nav" aria-label={t('shell.nav.ariaLabel')}>
              {[['/inicio', t('shell.nav.home')], ['/planejamentos', t('shell.nav.plans')], ['/sobre', t('shell.nav.about')]].map(([path, label]) => (
                <a key={path} href={`#${path}`} aria-current={route.path === path || (path === '/planejamentos' && plan) ? 'page' : undefined}>{label}</a>
              ))}
            </nav>
          )}
        </div>
      </header>
      {logoutState === 'error' && <p role="alert" className="sumi-session-error">{t('shell.account.signOutError')}</p>}
      <div className="sumi-body">
        {work && menuOpen && <>
          <button className="sumi-menu-backdrop" aria-label={t('shell.menu.backdropClose')} tabIndex={-1} onClick={closeMenu} />
          <aside className="br-menu push active sumi-menu" id="main-navigation" ref={menu} role={mobileMenuOpen ? 'dialog' : undefined} aria-modal={mobileMenuOpen ? 'true' : undefined} aria-label={mobileMenuOpen ? t('shell.menu.dialogLabel') : undefined}>
            <div className="menu-container">
              <div className="menu-panel">
                <div className="menu-header">
                  <span className="menu-title">{t('shell.menu.title')}</span>
                  <button ref={closeButton} type="button" className="br-button circle small" aria-label={t('shell.menu.close')} onClick={closeMenu}><Icon name="close" /></button>
                </div>
                <nav className="menu-body" aria-label={t('shell.nav.ariaLabel')}>
                  {links.map(({ path, icon, text }) => (
                    <a key={path} className={`menu-item ${route.path === path || (path === '/planejamentos' && plan) ? 'active' : ''}`} aria-current={route.path === path || (path === '/planejamentos' && plan) ? 'page' : undefined} href={`#${path}`}>
                      <span className="icon"><Icon name={icon} /></span><span className="content">{text}</span>
                    </a>
                  ))}
                </nav>
                <div className="menu-footer"><a href="#/ajuda">{t('shell.menu.help')}</a></div>
              </div>
            </div>
          </aside>
        </>}
        <main id="main-content" tabIndex={-1} aria-busy={loading} inert={mobileMenuOpen}>
          <div className="sumi-content">
            {!!crumbs.length && (
              <nav className="br-breadcrumb planning-breadcrumb" aria-label={plan ? t('shell.breadcrumb.hierarchy') : t('shell.breadcrumb.location')}>
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
      <Footer inert={mobileMenuOpen} work={work} t={t} />
    </div>
  );
}
