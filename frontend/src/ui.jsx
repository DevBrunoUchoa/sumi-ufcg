import React, { useEffect, useId, useRef } from 'react';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTableCellsLarge, faLayerGroup, faPlus, faArrowRight, faChevronRight, faMagnifyingGlass, faCheck, faXmark, faPen, faRotateLeft, 
faChartColumn, faListUl, faBook, faLeaf, faCircleInfo, faUser, faCalendar, faLink, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons';

const iconMap = {
  grid: faTableCellsLarge,
  layers: faLayerGroup,
  plus: faPlus,
  arrow: faArrowRight,
  chevron: faChevronRight,
  search: faMagnifyingGlass,
  check: faCheck,
  close: faXmark,
  edit: faPen,
  history: faRotateLeft,
  chart: faChartColumn,
  list: faListUl,
  book: faBook,
  leaf: faLeaf,
  info: faCircleInfo,
  user: faUser,
  calendar: faCalendar,
  link: faLink,
  download: faDownload,
  upload: faUpload,
};

export function Icon({ name, size = 18, ...props }) {
  const selectedIcon = iconMap[name] || faBook;

  return (
    <FontAwesomeIcon 
      icon={selectedIcon} 
      style={{ fontSize: `${size}px` }} 
      {...props} 
    />
  );
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
