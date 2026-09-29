import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button, Icon, Modal } from './ui.jsx';
import { enviarAnexo, listarAnexos, obterUrlAnexo, removerAnexo } from './anexos-client.js';

const AttachmentsContext = createContext(null);
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.xlsx,.xls,.txt,.csv';
const ALLOWED_EXTENSIONS = new Set(ACCEPT.split(','));
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/plain', 'text/csv',
]);
const MAX_BYTES = 15 * 1024 * 1024;
const formatBytes = (bytes) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// A API lista os anexos do item inteiro. Consultar uma vez evita uma requisição
// por etapa e permite que o botão de envio apareça antes da resposta da rede.
export function AttachmentsProvider({ itemId, enabled, children }) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'ready', anexos: [] });
  const requestVersion = useRef(0);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const version = ++requestVersion.current;
    try {
      const anexos = await listarAnexos(itemId);
      if (version === requestVersion.current) setState({ status: 'ready', anexos });
    } catch {
      if (version === requestVersion.current) setState((current) => ({ ...current, status: 'error' }));
    }
  }, [enabled, itemId]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const version = ++requestVersion.current;
    listarAnexos(itemId)
      .then((anexos) => { if (active && version === requestVersion.current) setState({ status: 'ready', anexos }); })
      .catch(() => { if (active && version === requestVersion.current) setState((current) => ({ ...current, status: 'error' })); });
    return () => { active = false; };
  }, [enabled, itemId]);
  return <AttachmentsContext.Provider value={{ state, reload }}>{children}</AttachmentsContext.Provider>;
}

// Documentos de execução/comprovação vinculados a uma etapa ou a um resultado.
export function Attachments({ itemId, etapaId, resultadoId, canManage, buttonVariant = 'secondary' }) {
  const { state, reload } = useContext(AttachmentsContext);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const anexos = state.anexos.filter((anexo) => (etapaId ? anexo.etapaId === etapaId : resultadoId ? anexo.resultadoId === resultadoId : !anexo.etapaId && !anexo.resultadoId));

  function chooseFile(selected) {
    setError('');
    if (!selected) return;
    const extension = `.${selected.name.split('.').at(-1)?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME.has(selected.type)) {
      setFile(null);
      setError('Formato não permitido. Selecione uma imagem, PDF, XLSX, XLS, TXT ou CSV.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setFile(null);
      setError('O arquivo deve ter no máximo 15 MB.');
      return;
    }
    setFile(selected);
  }

  function close(event) {
    event?.preventDefault();
    if (sending) return;
    setOpen(false);
    setFile(null);
    setError('');
    setDragging(false);
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!file || sending) return;
    setSending(true);
    setError('');
    try {
      await enviarAnexo(itemId, file, { etapaId, resultadoId });
      await reload();
      setSending(false);
      setOpen(false);
      setFile(null);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o arquivo.');
      setSending(false);
    }
  }

  async function handleOpen(anexo) {
    try {
      const { url } = await obterUrlAnexo(anexo.id);
      window.open(url, '_blank', 'noopener');
    } catch {
      setError('Não foi possível abrir o arquivo.');
    }
  }

  async function handleRemove(anexo) {
    try {
      await removerAnexo(anexo.id);
      await reload();
    } catch {
      setError('Não foi possível remover o arquivo.');
    }
  }

  if (!canManage && anexos.length === 0) return null;
  return <div className="attachments">
    {anexos.length > 0 && <ul className="attachments-list">{anexos.map((anexo) => <li key={anexo.id}>
      <button type="button" className="attachment-link" onClick={() => handleOpen(anexo)}><Icon name="link" size={13} /><span>{anexo.nomeArquivo}</span><small>{formatBytes(anexo.tamanhoBytes)}</small></button>
      {canManage && <button type="button" className="attachment-remove" aria-label={`Remover ${anexo.nomeArquivo}`} onClick={() => handleRemove(anexo)}><Icon name="close" size={12} /></button>}
    </li>)}</ul>}
    {canManage && <Button className="attachment-trigger" variant={buttonVariant} icon="upload" onClick={() => setOpen(true)}>Anexar documento</Button>}
    {!open && error && <p role="alert" className="form-error">{error}</p>}
    {open && <Modal title="Anexar documento" subtitle="Envie um arquivo para esta etapa ou resultado." onClose={close}>
      <form onSubmit={handleUpload}>
        <div className={`attachment-dropzone ${dragging ? 'dragging' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
          <Icon name="upload" size={28} />
          <p>Arraste um arquivo para cá</p>
          <span>ou</span>
          <Button type="button" data-initial-focus="true" onClick={() => inputRef.current?.click()}>Selecionar arquivo</Button>
          <input ref={inputRef} type="file" accept={ACCEPT} hidden aria-label="Selecionar arquivo para anexar" onChange={(event) => chooseFile(event.target.files[0])} />
        </div>
        <p className="attachment-constraints">Formatos permitidos: PNG, JPG, GIF, WEBP, PDF, XLSX, XLS, TXT e CSV. Tamanho máximo: 15 MB.</p>
        {state.status === 'error' && <p className="attachment-list-error" role="status">Não foi possível carregar os anexos existentes. <button type="button" onClick={reload}>Tentar novamente</button></p>}
        {file && <p className="attachment-selected"><Icon name="link" size={15} /><span>{file.name}</span><small>{formatBytes(file.size)}</small></p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="form-end"><Button type="button" onClick={close} disabled={sending}>Cancelar</Button><Button type="submit" variant="primary" disabled={!file || sending}>{sending ? 'Enviando…' : 'Enviar arquivo'}</Button></div>
      </form>
    </Modal>}
  </div>;
}
