import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import { enviarAnexo, listarAnexos, obterUrlAnexo, removerAnexo } from './anexos-client.js';

const formatBytes = (bytes) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.xlsx,.xls,.txt,.csv';
const TAMANHO_MAXIMO_MB = 15;

// Documentos de execução/comprovação (imagem, PDF, xlsx, txt) anexados a
// uma etapa ou a um resultado — Plano de Negócio, Módulo 3: "ações, etapas,
// responsáveis, prazos e documentos". Fora do ciclo de save do workspace de
// propósito (upload é multipart) — ver src/anexos-client.js.
export function Attachments({ itemId, etapaId, resultadoId, canManage }) {
  const [state, setState] = useState({ status: 'loading', anexos: [] });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const reload = () => {
    setState((current) => ({ ...current, status: 'loading' }));
    listarAnexos(itemId)
      .then((todos) => {
        const filtrados = todos.filter((anexo) => (etapaId ? anexo.etapaId === etapaId : resultadoId ? anexo.resultadoId === resultadoId : !anexo.etapaId && !anexo.resultadoId));
        setState({ status: 'ready', anexos: filtrados });
      })
      .catch(() => setState({ status: 'error', anexos: [] }));
  };
  useEffect(reload, [itemId, etapaId, resultadoId]);

  async function handleUpload(event) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    setSending(true);
    setError('');
    try {
      await enviarAnexo(itemId, arquivo, { etapaId, resultadoId });
      reload();
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o arquivo.');
    } finally {
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
      reload();
    } catch {
      setError('Não foi possível remover o arquivo.');
    }
  }

  if (state.status === 'loading') return null;
  return (
    <div className="attachments">
      {state.anexos.length > 0 && (
        <ul className="attachments-list">
          {state.anexos.map((anexo) => (
            <li key={anexo.id}>
              <button type="button" className="attachment-link" onClick={() => handleOpen(anexo)}>
                <Icon name="link" size={13} />
                <span>{anexo.nomeArquivo}</span>
                <small>{formatBytes(anexo.tamanhoBytes)}</small>
              </button>
              {canManage && <button type="button" className="attachment-remove" aria-label={`Remover ${anexo.nomeArquivo}`} onClick={() => handleRemove(anexo)}><Icon name="close" size={12} /></button>}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="attachment-upload-row">
          <label className="attachment-upload">
            <Icon name="link" size={13} />
            <span>{sending ? 'Enviando…' : 'Anexar arquivo'}</span>
            <input type="file" accept={ACCEPT} onChange={handleUpload} disabled={sending} />
          </label>
          <small className="attachment-hint">Imagem, PDF, xlsx, xls, txt ou csv — máx. {TAMANHO_MAXIMO_MB}MB</small>
        </div>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  );
}
