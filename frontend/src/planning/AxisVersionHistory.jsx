import { useEffect, useState } from 'react';
import { Badge, Icon } from '../ui.jsx';
import { listarVersoesEixo, obterUrlVersaoEixo } from '../eixo-versoes-client.js';

const formatDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatBytes = (bytes) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Histórico de importações do eixo, por período do ciclo do plano — cada
// reimportação de planilha retém o arquivo original e um retrato de
// cobertura de execução e de riscos naquele momento (não editável, só
// consulta). Ver backend/src/modules/planning/eixoVersoes.service.ts.
export function AxisVersionHistory({ axisId }) {
  // AxisVersionHistory remonta a cada troca de eixo (a árvore de PdiWorkspace
  // já usa key={axis.id+objective.id} em AxisOverview), então axisId nunca
  // muda com o componente montado — não precisa resetar o estado no efeito.
  const [state, setState] = useState({ status: 'loading', versoes: [] });

  useEffect(() => {
    let active = true;
    listarVersoesEixo(axisId)
      .then((versoes) => { if (active) setState({ status: 'ready', versoes }); })
      .catch(() => { if (active) setState({ status: 'error', versoes: [] }); });
    return () => { active = false; };
  }, [axisId]);

  async function abrir(versao) {
    try {
      const { url } = await obterUrlVersaoEixo(versao.id);
      window.open(url, '_blank', 'noopener');
    } catch {
      // Falha silenciosa é aceitável aqui — é um link de conveniência num
      // painel de consulta, não um fluxo crítico; o retrato numérico da
      // versão continua visível mesmo se o download falhar.
    }
  }

  if (state.status === 'loading') return null;
  if (state.status === 'error') return null;
  if (!state.versoes.length) return null;

  const porPeriodo = new Map();
  for (const versao of state.versoes) {
    if (!porPeriodo.has(versao.periodo)) porPeriodo.set(versao.periodo, []);
    porPeriodo.get(versao.periodo).push(versao);
  }
  const periodos = [...porPeriodo.keys()].sort((a, b) => b - a);

  return <details className="axis-version-history">
    <summary>Histórico de versões do eixo <span className="picker-count">({state.versoes.length})</span></summary>
    <p className="hint">Cada importação de planilha fica registrada por período, com o arquivo original e um retrato de cobertura de execução e de riscos naquele momento.</p>
    {periodos.map((periodo) => <div className="axis-version-period" key={periodo}>
      <h4>Período {periodo}</h4>
      <ul className="axis-version-list">{porPeriodo.get(periodo).map((versao) => <li key={versao.id}>
        <div className="axis-version-summary">
          <Badge>{versao.coberturaExecucaoPercentual}% execução</Badge>
          <Badge tone={versao.riscosTotal > 0 ? 'attention' : 'neutral'}>{versao.riscosTotal} risco{versao.riscosTotal === 1 ? '' : 's'}</Badge>
          <span className="hint">{versao.itensCriados} nova{versao.itensCriados === 1 ? '' : 's'}, {versao.itensAtualizados} atualizada{versao.itensAtualizados === 1 ? '' : 's'}</span>
        </div>
        <button type="button" className="attachment-link" onClick={() => abrir(versao)}><Icon name="link" size={13} /><span>{versao.arquivoNome}</span><small>{formatBytes(versao.arquivoTamanhoBytes)}</small></button>
        <p className="hint">Enviado por {versao.enviadoPor} em {formatDate(versao.enviadoEm)}</p>
      </li>)}</ul>
    </div>)}
  </details>;
}
