import { randomUUID } from "node:crypto";
import { HttpError } from "../../lib/http-error.js";
import { supabase } from "../../lib/supabase.js";
import { pode } from "../auth/auth.can.js";
import type { SessaoUsuario } from "../auth/auth.types.js";
import { eixoVersaoRepo, noPlanoRepo, type EixoVersaoRow } from "./planning.repository.js";
import type { Plan } from "./planning.types.js";

export const BUCKET_EIXO_VERSOES = "eixo-versoes";
export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024;

export interface EixoVersao {
  id: string;
  eixoId: string;
  periodo: number;
  arquivoNome: string;
  arquivoTipoMime: string;
  arquivoTamanhoBytes: number;
  itensCriados: number;
  itensAtualizados: number;
  coberturaExecucaoPercentual: number;
  riscosTotal: number;
  enviadoPor: string;
  enviadoEm: string;
}

function paraEixoVersao(row: EixoVersaoRow): EixoVersao {
  return {
    id: row.id,
    eixoId: row.eixo_id,
    periodo: row.periodo,
    arquivoNome: row.arquivo_nome,
    arquivoTipoMime: row.arquivo_tipo_mime,
    arquivoTamanhoBytes: row.arquivo_tamanho_bytes,
    itensCriados: row.itens_criados,
    itensAtualizados: row.itens_atualizados,
    coberturaExecucaoPercentual: row.cobertura_execucao_percentual,
    riscosTotal: row.riscos_total,
    enviadoPor: row.enviado_por,
    enviadoEm: row.enviado_em,
  };
}

async function resolverRecursoDoEixo(eixoId: string): Promise<{ planId: string; axisId: string }> {
  const eixo = await noPlanoRepo.buscarPorId(eixoId);
  if (!eixo || eixo.nivel !== 0 || !eixo.no_pai_id) throw new HttpError(404, "Eixo não encontrado");
  return { planId: eixo.no_pai_id, axisId: eixo.id };
}

/**
 * Ano do ciclo do plano a que esta importação se refere — o ano corrente,
 * limitado à vigência do plano (plan.start..plan.end). Não é selecionável
 * pelo usuário: é inferido no momento da importação, como um "período do
 * PDI" automático pedido pela coordenação.
 */
export function periodoAtual(plano: Pick<Plan, "start" | "end">): number {
  const ano = new Date().getFullYear();
  return Math.min(Math.max(ano, plano.start), plano.end);
}

/**
 * Cobertura de execução do eixo: proporção de etapas ativas (não
 * canceladas) concluídas entre todas as iniciativas do eixo — mesma
 * métrica de "Execução das etapas" já usada em outras telas (não é
 * atingimento de meta/indicador).
 */
export function coberturaExecucao(itensDoEixo: Plan["items"]): number {
  const etapas = itensDoEixo.flatMap((item) => item.actions.flatMap((acao) => acao.tasks)).filter((etapa) => etapa.status !== "cancelled");
  if (etapas.length === 0) return 0;
  const concluidas = etapas.filter((etapa) => etapa.status === "completed").length;
  return Math.round((concluidas / etapas.length) * 100);
}

export const eixoVersoesService = {
  async listar(sessao: SessaoUsuario, eixoId: string): Promise<EixoVersao[]> {
    const recurso = await resolverRecursoDoEixo(eixoId);
    if (!pode(sessao, "plan.read_internal", recurso)) throw new HttpError(403, "Sem permissão para ver o histórico de versões deste eixo");
    const linhas = await eixoVersaoRepo.listarPorEixo(eixoId);
    return linhas.map(paraEixoVersao);
  },

  async registrar(
    sessao: SessaoUsuario,
    eixoId: string,
    arquivo: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    dados: { periodo: number; itensCriados: number; itensAtualizados: number; coberturaExecucaoPercentual: number; riscosTotal: number },
  ): Promise<EixoVersao> {
    if (!sessao.authenticated || !sessao.user) throw new HttpError(401, "Autenticação necessária");
    const caminho = `${eixoId}/${randomUUID()}-${arquivo.originalname.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-140)}`;
    const { error } = await supabase.storage.from(BUCKET_EIXO_VERSOES).upload(caminho, arquivo.buffer, {
      contentType: arquivo.mimetype,
      upsert: false,
    });
    if (error) throw new HttpError(500, `Falha ao reter o arquivo da importação: ${error.message}`);

    const linha = await eixoVersaoRepo.criar({
      eixoId,
      periodo: dados.periodo,
      arquivoNome: arquivo.originalname,
      arquivoTipoMime: arquivo.mimetype,
      arquivoTamanhoBytes: arquivo.size,
      arquivoCaminhoStorage: caminho,
      itensCriados: dados.itensCriados,
      itensAtualizados: dados.itensAtualizados,
      coberturaExecucaoPercentual: dados.coberturaExecucaoPercentual,
      riscosTotal: dados.riscosTotal,
      enviadoPor: sessao.user.name,
    });
    return paraEixoVersao(linha);
  },

  async gerarUrlDownload(sessao: SessaoUsuario, versaoId: string): Promise<{ url: string; nomeArquivo: string }> {
    const versao = await eixoVersaoRepo.buscarPorId(versaoId);
    if (!versao) throw new HttpError(404, "Versão não encontrada");
    const recurso = await resolverRecursoDoEixo(versao.eixo_id);
    if (!pode(sessao, "plan.read_internal", recurso)) throw new HttpError(403, "Sem permissão para baixar este arquivo");
    const { data, error } = await supabase.storage.from(BUCKET_EIXO_VERSOES).createSignedUrl(versao.arquivo_caminho_storage, 60);
    if (error || !data) throw new HttpError(500, `Falha ao gerar link do arquivo: ${error?.message}`);
    return { url: data.signedUrl, nomeArquivo: versao.arquivo_nome };
  },
};
