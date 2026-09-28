import React, { useEffect, useId, useRef, useState } from 'react';
import { BrSelect, BrSelectOption, BrInput, BrButton, BrTextarea } from '@govbr-ds/webcomponents-react';
import { defineCustomElement as defineBrDatetimePicker } from '@govbr-ds/webcomponents/dist/components/br-datetime-picker.js';
defineBrDatetimePicker();

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTableCellsLarge, faLayerGroup, faPlus, faArrowRight, faChevronRight, faMagnifyingGlass, faCheck, faXmark, faPen, faRotateLeft, 
faChartColumn, faListUl, faBook, faLeaf, faCircleInfo, faUser, faCalendar, faLink, faDownload, faUpload, faExclamation, faEye } from '@fortawesome/free-solid-svg-icons';

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
  danger: faExclamation,
  eye: faEye,
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

export function Button({
  children,
  icon,
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}) {
  
  return (
    <BrButton
      emphasis={variant}
      type={type}
      className={className}
      {...props}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </BrButton>
  )
}

const DENSITIES = ['small', 'medium', 'large'];
const toDensity = (density, size) => density || (DENSITIES.includes(size) ? size : undefined);

function textProps({ maxLength, minLength, ...rest }) {
  return {
    ...rest,
    maxlength: maxLength ?? rest.maxlength,
    minlength: minLength ?? rest.minlength,
  };
}

export function Input({ label, id, size, className = '', density, button, onChange, value, defaultValue, ...props }) {
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = value !== undefined ? value : inner;
  const handleInput = (event) => {
    if (value === undefined) setInner(event.target.value);
    onChange?.(event);
  };
  return (
    <BrInput
      customId={id}
      label={label}
      density={toDensity(density, size)}
      className={className}
      value={current}
      onInput={handleInput}
      {...textProps(props)}
    >
      {button && React.cloneElement(button, { slot: 'action' })}
    </BrInput>
  );
}

export function Textarea({ label, id, size, className = '', density, rows, onChange, value, defaultValue, ...props }) {
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = value !== undefined ? value : inner;
  const handleInput = (event) => {
    if (value === undefined) setInner(event.target.value);
    onChange?.(event);
  };
  return (
    <BrTextarea
      customId={id}
      label={label}
      density={toDensity(density, size)}
      rows={rows != null ? Number(rows) : undefined}
      className={className}
      value={current}
      onInput={handleInput}
      {...textProps(props)}
    />
  );
}

export function Select({
  label,
  id,
  placeholder,
  value,
  defaultValue,
  onChange,
  name,
  options = [],
  className = '',
  ...props
}) {
  // Valor interno para o modo não controlado (defaultValue) e para o FormData.
  const [inner, setInner] = useState(defaultValue == null ? '' : String(defaultValue));
  const current = value !== undefined ? String(value ?? '') : inner;

  const normalized = options.map((option) =>
    typeof option === 'object' && option !== null
      ? { label: String(option.label), value: String(option.value) }
      : { label: String(option), value: String(option) }
  );

  // A opção vazia ({ value: '', label: 'Selecione' }) vira o placeholder do DS.
  // Se o rótulo dela for "Selecione", ela sai da lista; se for outro texto
  // (ex.: "Sem meta definida"), continua selecionável.
  const empty = normalized.find((option) => option.value === '');
  const list = empty?.label === 'Selecione' ? normalized.filter((option) => option !== empty) : normalized;
  const placeholderText = placeholder || empty?.label || 'Selecione';

  function handleChange(event) {
    const next = String(event.detail ?? '');
    if (!next && current && !list.some((option) => option.value === '')) return;
    setInner(next);
    onChange?.({ target: { value: next }, currentTarget: { value: next } });
  }

  const selectRef = useRef(null);

  useEffect(() => {
    if (selectRef.current && selectRef.current.value !== current) selectRef.current.value = current;
  }, [current, normalized.length]);

  useEffect(() => {
    const el = selectRef.current;
    if (!el) return;

    const findOption = (event) =>
      event.composedPath().find((node) => node.tagName === 'BR-SELECT-OPTION');

    const handleOver = (event) => {
      const option = findOption(event);
      if (option) option.style.setProperty('--background', 'var(--surface-hover)');
    };
    const handleOut = (event) => {
      const option = findOption(event);
      if (option) option.style.removeProperty('--background');
    };

    el.addEventListener('mouseover', handleOver);
    el.addEventListener('mouseout', handleOut);
    return () => {
      el.removeEventListener('mouseover', handleOver);
      el.removeEventListener('mouseout', handleOut);
    };
  }, [list]);

  return (
    <>
      <BrSelect
        ref={selectRef}
        customId={id}
        label={label}
        placeholder={placeholderText}
        value={current}
        onValueChange={handleChange}
        className={className}
        {...props}
      >
        {list.map((opt) => (
          <BrSelectOption key={opt.value} label={opt.label} value={opt.value} selected={opt.value === current} />
        ))}
      </BrSelect>
      {name && <input type="hidden" name={name} value={current} />}
    </>
  );
}

export function DatePicker({ value = '', onChange, name, ...props }) {
  const pickerRef = useRef(null);
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const handleValueChange = () => onChange?.(picker.serializedValue || '');
    picker.addEventListener('valueChange', handleValueChange);
    return () => picker.removeEventListener('valueChange', handleValueChange);
  }, [onChange]);
  useEffect(() => {
    if (pickerRef.current && pickerRef.current.serializedValue !== value) pickerRef.current.serializedValue = value;
  }, [value]);
  return <>
    <br-datetime-picker ref={pickerRef} mode="date" locale="pt-BR" serializedValue={value} {...props} />
    {name && <input type="hidden" name={name} value={value} />}
  </>;
}

export function Badge({ children, tone = 'neutral' }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Field({ label, help, children, className = '' }) {
  const id = useId();
  // Componentes do DS já renderizam o próprio label; só os demais usam o <label> do Field.
  const isGov = [Input, Textarea, Select].includes(children.type);
  const extra = { id, 'data-initial-focus': children.props.autoFocus ? 'true' : undefined, 'aria-describedby': help ? `${id}-help` : undefined };
  return <div className={`field ${className}`}>{!isGov && <label htmlFor={id}>{label}</label>}{React.cloneElement(children, isGov ? { ...extra, label } : extra)}{help && <small id={`${id}-help`}>{help}</small>}</div>;
}
export function Empty({ title, children, action }) {
  return <div className="empty"><span className="empty-icon"><Icon name="layers" size={25} /></span><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef(null);
  function containFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('button:not([disabled]), br-input:not([disabled]), br-select:not([disabled]), br-textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    const firstField = ref.current.querySelector('[data-initial-focus]') || ref.current.querySelector('br-input, br-select, br-textarea, input:not([type="hidden"]), select, textarea');
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
