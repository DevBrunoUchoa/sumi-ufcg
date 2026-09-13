import React, { useEffect, useId, useRef } from 'react';

const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  layers: 'm12 3 9 5-9 5-9-5 9-5z M3 12l9 5 9-5 M3 16l9 5 9-5',
  plus: 'M12 5v14 M5 12h14',
  arrow: 'M5 12h14 m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12 M6 18 18 6',
  edit: 'm15 4 5 5 M4 20l5-1L21 7l-5-5L4 14v6z',
  history: 'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2',
  chart: 'M4 3v17h17 M8 15v-4 M13 15V7 M18 15v-7',
  list: 'M9 6h12 M9 12h12 M9 18h12 M3 6h1 M3 12h1 M3 18h1',
  book: 'M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2 M3 17h17 M8 7h8 M8 11h5',
  leaf: 'M4 20c0-9 5-15 16-16 0 12-6 17-13 13 M4 20l10-10',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2 M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  calendar: 'M4 5h16v16H4z M4 10h16 M8 2v6 M16 2v6',
  link: 'm10 13 4-4 M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
};
export function Icon({ name, size = 18, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.book} /></svg>;
}
export function Button({ children, icon, variant = 'secondary', className = '', ...props }) {
  return <button type="button" className={`button ${variant} ${className}`} {...props}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}
export function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Field({ label, help, children, className = '' }) {
  const id = useId();
  return <div className={`field ${className}`}><label htmlFor={id}>{label}</label>{React.cloneElement(children, { id, 'data-initial-focus': children.props.autoFocus ? 'true' : undefined, 'aria-describedby': help ? `${id}-help` : undefined })}{help && <small id={`${id}-help`}>{help}</small>}</div>;
}
export function Empty({ title, children, action }) {
  return <div className="empty"><span className="empty-icon"><Icon name="layers" size={25} /></span><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef(null);
  function containFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    const firstField = ref.current.querySelector('[data-initial-focus]') || ref.current.querySelector('input, select, textarea');
    firstField?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby="dialog-title" onCancel={onClose} onKeyDown={containFocus}>
    <div className="modal-heading"><div><h2 id="dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" aria-label="Fechar janela" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}
export function FormEnd({ onClose, submit = 'Salvar alterações', error }) {
  return <>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-end"><Button onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary">{submit}</Button></div></>;
}
