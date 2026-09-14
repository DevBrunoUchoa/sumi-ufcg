import { randomUUID } from "node:crypto";
import { HttpError } from "../../lib/http-error.js";
import { supabase } from "../../lib/supabase.js";
import { pode } from "../auth/auth.can.js";
import type { SessaoUsuario } from "../auth/auth.types.js";
import { anexoRepo, noPlanoRepo, type AnexoRow } from "./planning.repository.js";

export const BUCKET_ANEXOS = "anexos";
export const TIPOS_MIME_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
];
export const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024;

export interface Anexo {
  id: string;
  itemId: string;
  etapaId: string | null;
  resultadoId: string | null;
  nomeArquivo: string;
  tipoMime: string;
  tamanhoBytes: number;
  enviadoPor: string;
  enviadoEm: string;
}

function paraAnexo(row: AnexoRow): Anexo {
  return {
    id: row.id,
    itemId: row.no_plano_id,
    etapaId: row.etapa_id,
    resultadoId: row.resultado_id,
    nomeArquivo: row.nome_arquivo,
    tipoMime: row.tipo_mime,
    tamanhoBytes: row.tamanho_bytes,
    enviadoPor: row.enviado_por,
    enviadoEm: row.enviado_em,
  };
}

function sanitizarNomeArquivo(nome: string): string {
  return nome.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-140);
}

async function resolverRecursoDoItem(itemId: string): Promise<{ planId: string; axisId: string; itemId: string }> {
  const item = await noPlanoRepo.buscarPorId(itemId);
  if (!item || item.nivel !== 2) throw new HttpError(404, "Item não encontrado");
  const objetivo = item.no_pai_id ? await noPlanoRepo.buscarPorId(item.no_pai_id) : null;
  if (!objetivo) throw new HttpError(404, "Objetivo do item não encontrado");
  const eixo = objetivo.no_pai_id ? await noPlanoRepo.buscarPorId(objetivo.no_pai_id) : null;
  if (!eixo || !eixo.no_pai_id) throw new HttpError(404, "Eixo do item não encontrado");
  return { planId: eixo.no_pai_id, axisId: eixo.id, itemId };
}

function podeGerenciarAnexos(sessao: SessaoUsuario, recurso: { planId: string; axisId: string; itemId: string }): boolean {
  return pode(sessao, "stage.update", recurso) || pode(sessao, "result.create", recurso) || pode(sessao, "item.edit", recurso);
}

export const anexosService = {
  async listar(sessao: SessaoUsuario, itemId: string): Promise<Anexo[]> {
    const recurso = await resolverRecursoDoItem(itemId);
    if (!pode(sessao, "plan.read_internal", recurso)) throw new HttpError(403, "Sem permissão para ver os anexos deste item");
    const linhas = await anexoRepo.listarPorItem(itemId);
    return linhas.map(paraAnexo);
  },

  async enviar(
    sessao: SessaoUsuario,
    itemId: string,
    arquivo: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    contexto: { etapaId?: string | null; resultadoId?: string | null },
  ): Promise<Anexo> {
    if (!sessao.authenticated || !sessao.user) throw new HttpError(401, "Autenticação necessária para anexar documentos");
    const recurso = await resolverRecursoDoItem(itemId);
    if (!podeGerenciarAnexos(sessao, recurso)) throw new HttpError(403, "Sem permissão para anexar documentos neste item");
    if (!TIPOS_MIME_PERMITIDOS.includes(arquivo.mimetype)) {
      throw new HttpError(400, `Tipo de arquivo não permitido: ${arquivo.mimetype}`);
    }
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new HttpError(400, `Arquivo excede o limite de ${TAMANHO_MAXIMO_BYTES / 1024 / 1024}MB`);
    }

    const caminho = `${itemId}/${randomUUID()}-${sanitizarNomeArquivo(arquivo.originalname)}`;
    const { error } = await supabase.storage.from(BUCKET_ANEXOS).upload(caminho, arquivo.buffer, {
      contentType: arquivo.mimetype,
      upsert: false,
    });
    if (error) throw new HttpError(500, `Falha ao enviar arquivo: ${error.message}`);

    const linha = await anexoRepo.criar({
      noPlanoId: itemId,
      etapaId: contexto.etapaId ?? null,
      resultadoId: contexto.resultadoId ?? null,
      nomeArquivo: arquivo.originalname,
      tipoMime: arquivo.mimetype,
      tamanhoBytes: arquivo.size,
      caminhoStorage: caminho,
      enviadoPor: sessao.user.name,
    });
    return paraAnexo(linha);
  },

  async gerarUrlDownload(sessao: SessaoUsuario, anexoId: string): Promise<{ url: string; nomeArquivo: string }> {
    const anexo = await anexoRepo.buscarPorId(anexoId);
    if (!anexo) throw new HttpError(404, "Anexo não encontrado");
    const recurso = await resolverRecursoDoItem(anexo.no_plano_id);
    if (!pode(sessao, "plan.read_internal", recurso)) throw new HttpError(403, "Sem permissão para baixar este anexo");
    const { data, error } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(anexo.caminho_storage, 60);
    if (error || !data) throw new HttpError(500, `Falha ao gerar link do anexo: ${error?.message}`);
    return { url: data.signedUrl, nomeArquivo: anexo.nome_arquivo };
  },

  async remover(sessao: SessaoUsuario, anexoId: string): Promise<void> {
    const anexo = await anexoRepo.buscarPorId(anexoId);
    if (!anexo) throw new HttpError(404, "Anexo não encontrado");
    const recurso = await resolverRecursoDoItem(anexo.no_plano_id);
    if (!podeGerenciarAnexos(sessao, recurso)) throw new HttpError(403, "Sem permissão para remover este anexo");
    const { error } = await supabase.storage.from(BUCKET_ANEXOS).remove([anexo.caminho_storage]);
    if (error) throw new HttpError(500, `Falha ao remover arquivo: ${error.message}`);
    await anexoRepo.remover(anexoId);
  },
};
