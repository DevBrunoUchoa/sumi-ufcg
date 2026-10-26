import { isDeepStrictEqual } from "node:util";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { mailer } from "../../lib/mailer.js";
import { prepareRiskWrite } from "./risk-write-policy.js";
import { normalizeObjectiveOds, objectiveData } from "./objective-ods.js";
import { pode } from "../auth/auth.can.js";
import { usuarioRepository } from "../auth/auth.repository.js";
import type { SessaoUsuario } from "../auth/auth.types.js";
import {
  acaoRepo,
  anexoRepo,
  etapaRepo,
  historicoRepo,
  indicadorRepo,
  noPlanoRepo,
  resultadoRepo,
  riscoRepo,
  tipoPlanoRepo,
  type NoPlanoRow,
  type TipoPlanoRow,
} from "./planning.repository.js";
import type { Axis, Item, Objective, Plan, Risk, Template, Workspace } from "./planning.types.js";

// ---------------------------------------------------------------------------
// Leitura (GET /api/v1/planning/workspace)
// ---------------------------------------------------------------------------

function paraTemplate(row: TipoPlanoRow): Template {
  return {
    id: row.id,
    type: row.tipo,
    name: row.nome,
    version: row.versao,
    description: row.descricao ?? "",
    labels: {
      axis: (row.rotulos?.axis as string) ?? "Eixo",
      objective: (row.rotulos?.objective as string) ?? "Objetivo",
      item: (row.rotulos?.item as string) ?? "Item",
    },
    defaultPeriodicity: (row.periodicidade_padrao as "annual" | "final") ?? "annual",
    fields: (row.campos_extras as Template["fields"]) ?? [],
  };
}

function agruparPorPai<T extends { no_pai_id: string | null }>(linhas: T[]): Map<string | null, T[]> {
  const mapa = new Map<string | null, T[]>();
  for (const linha of linhas) {
    const grupo = mapa.get(linha.no_pai_id) ?? [];
    grupo.push(linha);
    mapa.set(linha.no_pai_id, grupo);
  }
  return mapa;
}

function agruparPorChave<T>(linhas: T[], chave: (linha: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const linha of linhas) {
    const id = chave(linha);
    const grupo = mapa.get(id) ?? [];
    grupo.push(linha);
    mapa.set(id, grupo);
  }
  return mapa;
}

export async function montarWorkspace(sessao: SessaoUsuario): Promise<Workspace> {
  const [tipoRows, noRows, indicadorRows, resultadoRows, acaoRows, etapaRows, riscoRows, historicoRows] = await Promise.all([
    tipoPlanoRepo.listar(),
    noPlanoRepo.listarTodos(),
    indicadorRepo.listarTodos(),
    resultadoRepo.listarTodos(),
    acaoRepo.listarTodos(),
    etapaRepo.listarTodos(),
    riscoRepo.listarTodos(),
    historicoRepo.listarTodos(),
  ]);

  const templates = tipoRows.map(paraTemplate);
  const templatePorId = new Map(templates.map((template) => [template.id, template]));
  const nosPorPai = agruparPorPai(noRows);
  const indicadorPorItem = new Map(indicadorRows.map((row) => [row.no_plano_id as string, row]));
  const resultadosPorItem = agruparPorChave(resultadoRows, (row) => row.no_plano_id as string);
  const acoesPorItem = agruparPorChave(acaoRows, (row) => row.no_plano_id as string);
  const etapasPorAcao = agruparPorChave(etapaRows, (row) => row.acao_id as string);
  const riscosPorItem = agruparPorChave(riscoRows, (row) => row.no_plano_id as string);
  const historicoPorItem = agruparPorChave(historicoRows, (row) => row.no_plano_id as string);

  const raizes = noRows.filter((no) => no.nivel === -1);
  const planos: Plan[] = [];

  for (const raiz of raizes) {
    const template = templatePorId.get(raiz.tipo_plano_id);
    if (!template) continue; // tipo_plano removido/inconsistente — não deveria acontecer, mas não derruba a resposta.

    const dados = raiz.dados as { shortName?: string; name?: string; start?: number; end?: number; status?: "draft" | "published" };
    const planId = raiz.id;
    const visivelInternamente = pode(sessao, "plan.read_internal", { planId });
    const publicado = dados.status === "published";
    if (!publicado && !visivelInternamente) continue; // rascunho e sem acesso interno: plano inteiro fora da resposta.

    const eixosRows = nosPorPai.get(raiz.id) ?? [];
    const axes: Axis[] = eixosRows.map((row) => {
      const d = row.dados as Partial<Axis>;
      return {
        id: row.id,
        code: String(d.code ?? ""),
        name: String(d.name ?? ""),
        color: String(d.color ?? "#2f78a5"),
        ownerUnit: String(d.ownerUnit ?? ""),
        managerIds: Array.isArray(d.managerIds) ? d.managerIds : [],
        reviewerIds: Array.isArray(d.reviewerIds) ? d.reviewerIds : [],
        customGrants: Array.isArray(d.customGrants)
          ? d.customGrants.filter(
              (g): g is { userId: string; permissions: string[] } =>
                Boolean(g) && typeof g === "object" && typeof (g as { userId?: unknown }).userId === "string" && Array.isArray((g as { permissions?: unknown }).permissions),
            )
          : [],
      };
    });

    const objectives: Objective[] = [];
    const items: Item[] = [];

    for (const eixo of eixosRows) {
      const objetivosRows = nosPorPai.get(eixo.id) ?? [];
      for (const objetivo of objetivosRows) {
        const od = objetivo.dados as Partial<Objective>;
        const ods = normalizeObjectiveOds(od.ods);
        objectives.push({ id: objetivo.id, axisId: eixo.id, code: String(od.code ?? ""), title: String(od.title ?? ""), ...(ods === undefined ? {} : { ods }) });

        const itensRows = nosPorPai.get(objetivo.id) ?? [];
        for (const itemRow of itensRows) {
          const id = itemRow.id;
          const d = itemRow.dados as Partial<Item> & { extras?: Record<string, string> };
          const acessoInterno = pode(sessao, "plan.read_internal", { planId, axisId: eixo.id });
          const acoesRow = acoesPorItem.get(id) ?? [];

          const indicadorRow = indicadorPorItem.get(id) as Record<string, unknown> | undefined;
          const metric = indicadorRow
            ? {
                name: String(indicadorRow.nome ?? ""),
                measurementMode: indicadorRow.modo_medicao as Item["metric"]["measurementMode"],
                valueType: indicadorRow.tipo_valor as Item["metric"]["valueType"],
                unit: String(indicadorRow.unidade ?? ""),
                periodicity: indicadorRow.periodicidade as Item["metric"]["periodicity"],
                baseline: indicadorRow.linha_base as Item["metric"]["baseline"],
                reference: String(indicadorRow.referencia ?? ""),
                direction: indicadorRow.direcao as Item["metric"]["direction"],
                targets: (indicadorRow.metas as Item["metric"]["targets"]) ?? {},
                formula: String(indicadorRow.formula ?? ""),
                completedValue: indicadorRow.valor_concluido == null ? undefined : String(indicadorRow.valor_concluido),
              }
            : {
                name: "",
                measurementMode: "manual" as const,
                valueType: "number" as const,
                unit: "",
                periodicity: "annual" as const,
                baseline: null,
                reference: "",
                direction: "up" as const,
                targets: {},
                formula: "",
              };

          items.push({
            id,
            code: String(d.code ?? ""),
            axisId: eixo.id,
            objectiveId: objetivo.id,
            title: String(d.title ?? ""),
            owner: String(d.owner ?? ""),
            partners: String(d.partners ?? ""),
            description: String(d.description ?? ""),
            source: String(d.source ?? ""),
            reviewStatus: (d.reviewStatus as Item["reviewStatus"]) ?? "draft",
            reviewNote: String(d.reviewNote ?? ""),
            linkedPlan: d.linkedPlan,
            metric,
            measurements: (resultadosPorItem.get(id) ?? []).map((row) => ({
              id: row.id as string,
              year: row.ano as number,
              value: row.valor as Item["measurements"][number]["value"],
              note: String(row.observacao ?? ""),
              at: row.em as string,
              evidence: String(row.evidencia ?? ""),
            })),
            extras: d.extras ?? {},
            actions: acoesRow.map((acao) => ({
              id: acao.id as string,
              code: String(acao.codigo ?? ""),
              title: String(acao.titulo ?? ""),
              owner: String(acao.responsavel ?? ""),
              deadline: String(acao.prazo ?? ""),
              tasks: (etapasPorAcao.get(acao.id as string) ?? []).map((etapa) => ({
                id: etapa.id as string,
                title: String(etapa.titulo ?? ""),
                status: etapa.situacao as Item["actions"][number]["tasks"][number]["status"],
                deadline: String(etapa.prazo ?? ""),
                justification: String(etapa.justificativa ?? ""),
                partners: String(etapa.parceiros ?? ""),
              })),
            })),
            history: acessoInterno
              ? (historicoPorItem.get(id) ?? []).map((row) => ({
                  id: row.id as string,
                  at: row.em as string,
                  text: String(row.texto ?? ""),
                  actor: String(row.autor ?? ""),
                }))
              : [],
            risks: acessoInterno
              ? (riscosPorItem.get(id) ?? []).map(
                  (row): Risk => ({
                    id: row.id as string,
                    eixo: String(row.eixo ?? ""),
                    objetivo: String(row.objetivo ?? ""),
                    refIniciativa: String(row.ref_iniciativa ?? ""),
                    iniciativa: String(row.iniciativa ?? ""),
                    refAcao: String(row.ref_acao ?? ""),
                    acao: String(row.acao_estrategica ?? ""),
                    idRisco: String(row.id_risco ?? ""),
                    actionId: String(row.acao_id ?? ""),
                    stage: String(row.etapa_nome ?? ""),
                    title: String(row.titulo ?? ""),
                    probability: row.probabilidade as number,
                    impact: row.impacto as number,
                    owner: String(row.responsavel ?? ""),
                    strategicRisk: String(row.risco_estrategico ?? ""),
                    cause: String(row.causa ?? ""),
                    consequence: String(row.consequencia ?? ""),
                    category: String(row.categoria ?? ""),
                    controls: String(row.controles ?? ""),
                    controlType: String(row.tipo_controle ?? ""),
                    maturity: String(row.maturidade ?? ""),
                    response: String(row.resposta ?? ""),
                    treatment: String(row.tratamento ?? ""),
                    treatmentOwner: String(row.responsavel_tratamento ?? ""),
                    prazoInicio: String(row.prazo_inicio ?? ""),
                    deadline: String(row.prazo ?? ""),
                    custoPrevisto: row.custo_previsto == null ? null : Number(row.custo_previsto),
                    execution: Number(row.execucao ?? 0),
                    etapaConcluida: String(row.etapa_concluida ?? ""),
                    dataInicioReal: String(row.data_inicio_real ?? ""),
                    dataConclusaoReal: String(row.data_conclusao_real ?? ""),
                    situation: String(row.situacao ?? ""),
                    justificativa: String(row.justificativa ?? ""),
                    review: String(row.revisao ?? ""),
                    dataProximaRevisao: String(row.data_proxima_revisao ?? ""),
                    mudancaProcesso: String(row.mudanca_processo ?? ""),
                    novosRiscos: String(row.novos_riscos ?? ""),
                    acoesCorretivas: String(row.acoes_corretivas ?? ""),
                    licoesAprendidas: String(row.licoes_aprendidas ?? ""),
                    status: String(row.status ?? ""),
                  }),
                )
              : [],
          });
        }
      }
    }

    planos.push({
      id: planId,
      type: template.type,
      shortName: String(dados.shortName ?? ""),
      name: String(dados.name ?? ""),
      start: Number(dados.start ?? 0),
      end: Number(dados.end ?? 0),
      status: dados.status ?? "draft",
      template,
      axes,
      objectives,
      items,
    });
  }

  return { version: 2, templates, plans: planos };
}

// ---------------------------------------------------------------------------
// Escrita (PUT /api/v1/planning/workspace)
// ---------------------------------------------------------------------------

function diferente(a: unknown, b: unknown): boolean {
  // JSONB reorders keys; undefined properties are also used below to exclude
  // protected fields from a comparison. Preserve both JSON semantics.
  const asJson = (value: unknown): unknown => {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? undefined : JSON.parse(serialized);
  };
  return !isDeepStrictEqual(asJson(a), asJson(b));
}

function exigir(autorizado: boolean, mensagem: string): void {
  if (!autorizado) throw new HttpError(403, mensagem);
}

function recursoDoItem(planId: string, axisId: string, itemId: string) {
  return { planId, axisId, itemId };
}

/**
 * Apaga um plano inteiro (eixo, objetivos, iniciativas, ações, etapas,
 * indicadores, resultados, riscos, histórico e anexos) — restrito a quem
 * administra os modelos (model.manage), já que não há como desfazer. A
 * cascata é feita pelo próprio banco (ON DELETE CASCADE a partir de
 * no_plano), então apagar a raiz basta.
 */
export async function removerPlano(sessao: SessaoUsuario, planId: string): Promise<void> {
  if (!sessao.authenticated) {
    throw new HttpError(401, "Autenticação necessária para remover um plano");
  }
  exigir(pode(sessao, "model.manage"), "Sem permissão para remover planos");
  const raiz = await noPlanoRepo.buscarPorId(planId);
  if (!raiz || raiz.nivel !== -1) {
    throw new HttpError(404, "Plano não encontrado");
  }
  await noPlanoRepo.removerLote([planId]);
}

export async function salvarWorkspace(sessao: SessaoUsuario, workspace: Workspace): Promise<void> {
  if (!sessao.authenticated) {
    throw new HttpError(401, "Autenticação necessária para gravar alterações");
  }

  const [tipoRowsAtuais, noRowsAtuais] = await Promise.all([tipoPlanoRepo.listar(), noPlanoRepo.listarTodos()]);
  const tipoPorId = new Map(tipoRowsAtuais.map((row) => [row.id, row]));
  const noPorId = new Map(noRowsAtuais.map((row) => [row.id, row]));

  // ---- templates ------------------------------------------------------------
  for (const template of workspace.templates) {
    const atual = tipoPorId.get(template.id);
    if (!atual) throw new HttpError(400, `Modelo "${template.id}" não existe`);
    const rotulosNovos = template.labels;
    const mudou = diferente(atual.rotulos, rotulosNovos) || diferente(atual.campos_extras, template.fields) || atual.versao !== template.version;
    if (!mudou) continue;
    exigir(pode(sessao, "model.manage"), `Sem permissão para editar o modelo "${template.id}"`);
    await tipoPlanoRepo.atualizarMetadados(template.id, { rotulos: rotulosNovos, camposExtras: template.fields, versao: template.version });
  }

  const [indicadorRows, acaoRows, etapaRows, resultadoRows, riscoRows, historicoRows] = await Promise.all([
    indicadorRepo.listarTodos(),
    acaoRepo.listarTodos(),
    etapaRepo.listarTodos(),
    resultadoRepo.listarTodos(),
    riscoRepo.listarTodos(),
    historicoRepo.listarTodos(),
  ]);
  const estadoAntigo: EstadoAntigoWorkspace = {
    indicadorPorItem: new Map(indicadorRows.map((row) => [row.no_plano_id as string, row])),
    acoesPorItem: agruparPorChave(acaoRows, (row) => row.no_plano_id as string),
    etapasPorAcao: agruparPorChave(etapaRows, (row) => row.acao_id as string),
    resultadosPorItem: agruparPorChave(resultadoRows, (row) => row.no_plano_id as string),
    riscosPorItem: agruparPorChave(riscoRows, (row) => row.no_plano_id as string),
    historicoPorItem: agruparPorChave(historicoRows, (row) => row.no_plano_id as string),
  };

  for (const plano of workspace.plans) {
    await salvarPlano(sessao, plano, noPorId, estadoAntigo);
  }
}

interface EstadoAntigoWorkspace {
  indicadorPorItem: Map<string, Record<string, unknown>>;
  acoesPorItem: Map<string, Record<string, unknown>[]>;
  etapasPorAcao: Map<string, Record<string, unknown>[]>;
  resultadosPorItem: Map<string, Record<string, unknown>[]>;
  riscosPorItem: Map<string, Record<string, unknown>[]>;
  historicoPorItem: Map<string, Record<string, unknown>[]>;
}

async function salvarPlano(sessao: SessaoUsuario, plano: Plan, noPorId: Map<string, NoPlanoRow>, estadoAntigo: EstadoAntigoWorkspace): Promise<void> {
  const raizAtual = noPorId.get(plano.id);
  const dadosRaizNovos = { shortName: plano.shortName, name: plano.name, start: plano.start, end: plano.end, status: plano.status };

  if (!raizAtual) {
    exigir(pode(sessao, "plan.manage", { planId: plano.id }), "Sem permissão para criar planejamentos");
    await noPlanoRepo.criarRaiz({ id: plano.id, tipoPlanoId: plano.template.id, dados: dadosRaizNovos });
  } else if (diferente(raizAtual.dados, dadosRaizNovos)) {
    exigir(pode(sessao, "plan.manage", { planId: plano.id }), "Sem permissão para editar este planejamento");
    await noPlanoRepo.upsertLote([{ id: plano.id, tipoPlanoId: plano.template.id, noPaiId: null, nivel: -1, ordem: 0, dados: dadosRaizNovos }]);
  }

  const eixosAtuais = [...noPorId.values()].filter((no) => no.no_pai_id === plano.id && no.nivel === 0);
  const eixosAtuaisPorId = new Map(eixosAtuais.map((no) => [no.id, no]));
  const eixoMudou =
    eixosAtuais.length !== plano.axes.length ||
    plano.axes.some((axis, index) => {
      const atual = eixosAtuaisPorId.get(axis.id);
      const dadosNovos = { code: axis.code, name: axis.name, color: axis.color, ownerUnit: axis.ownerUnit, managerIds: axis.managerIds, reviewerIds: axis.reviewerIds, customGrants: axis.customGrants };
      // customGrants foi adicionado depois (PR #17) e nunca foi retroagido
      // nas linhas já gravadas — "ausente" ali é equivalente a "[]" aqui, não
      // uma mudança real. Sem essa normalização, diferente() via JSON.stringify
      // via comparar chave ausente com [] presente, e eixoMudou fica sempre
      // true para qualquer eixo antigo (mascarado até agora porque só quem
      // já tinha plan.manage gravava no workspace).
      const customGrantsAtuais = Array.isArray(atual?.dados.customGrants) ? atual.dados.customGrants : [];
      const dadosAtuais = atual && { ...atual.dados, customGrants: customGrantsAtuais };
      return !atual || atual.ordem !== index || diferente(dadosAtuais, dadosNovos);
    });
  if (eixoMudou) {
    exigir(pode(sessao, "plan.manage", { planId: plano.id }), "Sem permissão para editar a estrutura deste planejamento");
    await noPlanoRepo.upsertLote(
      plano.axes.map((axis, index) => ({
        id: axis.id,
        tipoPlanoId: plano.template.id,
        noPaiId: plano.id,
        nivel: 0,
        ordem: index,
        dados: { code: axis.code, name: axis.name, color: axis.color, ownerUnit: axis.ownerUnit, managerIds: axis.managerIds, reviewerIds: axis.reviewerIds, customGrants: axis.customGrants },
      })),
    );
    const idsNovos = new Set(plano.axes.map((axis) => axis.id));
    await noPlanoRepo.removerLote(eixosAtuais.filter((no) => !idsNovos.has(no.id)).map((no) => no.id));
  }

  const objetivosAtuais = [...noPorId.values()].filter((no) => no.nivel === 1 && eixosAtuaisPorId.has(no.no_pai_id ?? ""));
  const objetivosAtuaisPorId = new Map(objetivosAtuais.map((no) => [no.id, no]));
  const objetivosAlterados = plano.objectives.filter((objective) => {
    const atual = objetivosAtuaisPorId.get(objective.id);
    const dadosNovos = objectiveData(objective, atual?.dados);
    const odsAtuais = normalizeObjectiveOds(atual?.dados.ods);
    const dadosAtuais = atual && { ...atual.dados, ...(odsAtuais === undefined ? {} : { ods: odsAtuais }) };
    return !atual || atual.no_pai_id !== objective.axisId || diferente(dadosAtuais, dadosNovos);
  });
  const idsObjetivosNovos = new Set(plano.objectives.map((objective) => objective.id));
  const objetivosRemovidos = objetivosAtuais.filter((no) => !idsObjetivosNovos.has(no.id));
  const objetivoMudou = objetivosAlterados.length > 0 || objetivosRemovidos.length > 0;
  if (objetivoMudou) {
    // Criar/atualizar/remover objetivo normalmente exige plan.manage (tela de
    // Estrutura, administrativa) — mas quando todo objetivo tocado pertence a
    // um eixo onde a sessão já tem item.edit, basta essa permissão de eixo:
    // é o caso da importação de planilha do Responsável Técnico do Eixo, que pode
    // introduzir um objetivo ainda não cadastrado dentro do seu próprio eixo.
    const eixosEnvolvidos = new Set([
      ...objetivosAlterados.map((objective) => objective.axisId),
      ...objetivosRemovidos.map((no) => no.no_pai_id).filter((id): id is string => Boolean(id)),
    ]);
    const temPermissaoPorEixo = [...eixosEnvolvidos].every((axisId) => pode(sessao, "item.edit", { planId: plano.id, axisId }));
    exigir(temPermissaoPorEixo || pode(sessao, "plan.manage", { planId: plano.id }), "Sem permissão para editar a estrutura deste planejamento");
    const contadorPorEixo = new Map<string, number>();
    await noPlanoRepo.upsertLote(
      plano.objectives.map((objective) => {
        const ordem = contadorPorEixo.get(objective.axisId) ?? 0;
        contadorPorEixo.set(objective.axisId, ordem + 1);
        return {
          id: objective.id,
          tipoPlanoId: plano.template.id,
          noPaiId: objective.axisId,
          nivel: 1,
          ordem,
          dados: objectiveData(objective, objetivosAtuaisPorId.get(objective.id)?.dados),
        };
      }),
    );
    await noPlanoRepo.removerLote(objetivosRemovidos.map((no) => no.id));
  }

  const objetivosValidosPorId = new Set(plano.objectives.map((objective) => objective.id));
  const itensAtuais = [...noPorId.values()].filter((no) => no.nivel === 2 && objetivosAtuaisPorId.has(no.no_pai_id ?? ""));
  const itensAtuaisPorId = new Map(itensAtuais.map((no) => [no.id, no]));

  const contadorItensPorObjetivo = new Map<string, number>();
  const itensParaGravar: { row: NoPlanoRow | undefined; item: Item }[] = [];
  for (const item of plano.items) {
    if (!objetivosValidosPorId.has(item.objectiveId)) continue; // já barrado pelo schema; defensivo
    itensParaGravar.push({ row: itensAtuaisPorId.get(item.id), item });
  }

  // Itens recém-enviados para validação neste save — calculado ANTES de
  // gravar (compara o reviewStatus antigo, já em mãos, com o novo) para
  // poder notificar os responsáveis do eixo por e-mail depois que a
  // gravação terminar, sem atrasar nem arriscar o salvamento em si (envio
  // de e-mail é melhor esforço, nunca motivo de falha do save).
  const itensRecemEnviados = itensParaGravar.filter(
    ({ row: atual, item }) => (atual?.dados as { reviewStatus?: string } | undefined)?.reviewStatus !== "submitted" && item.reviewStatus === "submitted",
  );

  // Paralelo, não sequencial: cada salvarItem já faz uma dezena de
  // idas-e-voltas ao banco por item, e um workspace com muitos itens
  // (ex.: importação de planilha) levava tempo demais nesse somatório
  // sequencial — o suficiente para estourar o timeout do proxy antes da
  // resposta chegar ao cliente, mesmo com a gravação em si concluindo com
  // sucesso. contadorItensPorObjetivo é seguro mesmo em paralelo: a leitura
  // e o incremento do contador de cada item acontecem de forma síncrona,
  // antes do primeiro await de salvarItem, então Promise.all(...map(...))
  // os executa na mesma ordem determinística que o loop sequencial fazia.
  await Promise.all(itensParaGravar.map(({ row: atual, item }) => salvarItem(sessao, plano, atual, item, contadorItensPorObjetivo, {
      indicadorAntigo: estadoAntigo.indicadorPorItem.get(item.id),
      acoesAntigas: estadoAntigo.acoesPorItem.get(item.id) ?? [],
      etapasAntigasPorAcao: estadoAntigo.etapasPorAcao,
      resultadosAntigos: estadoAntigo.resultadosPorItem.get(item.id) ?? [],
      riscosAntigos: estadoAntigo.riscosPorItem.get(item.id) ?? [],
      historicoAntigo: estadoAntigo.historicoPorItem.get(item.id) ?? [],
    })));

  if (itensRecemEnviados.length > 0) {
    notificarResponsaveisDeSubmissao(plano, itensRecemEnviados.map(({ item }) => item)).catch((err) =>
      logger.error({ err }, "Falha ao notificar responsáveis de itens enviados para validação"),
    );
  }

  const idsNovos = new Set(plano.items.map((item) => item.id));
  const itensRemovidos = itensAtuais.filter((no) => !idsNovos.has(no.id));
  if (itensRemovidos.length > 0) {
    exigir(pode(sessao, "item.edit", { planId: plano.id }), "Sem permissão para remover itens deste planejamento");
    await noPlanoRepo.removerLote(itensRemovidos.map((no) => no.id));
  }
}

/**
 * Notificação por e-mail (melhor esforço) para os Responsáveis de cada eixo
 * envolvido, quando um save deixa um ou mais itens com reviewStatus
 * "submitted" pela primeira vez — pedido explícito ao lado da recuperação
 * de senha: avisar quem precisa agir, sem depender de a pessoa entrar no
 * SUMI e conferir "Minhas pendências"/"Validações" por conta própria.
 */
async function notificarResponsaveisDeSubmissao(plano: Plan, itens: Item[]): Promise<void> {
  const porEixo = new Map<string, Item[]>();
  for (const item of itens) {
    const lista = porEixo.get(item.axisId) ?? [];
    lista.push(item);
    porEixo.set(item.axisId, lista);
  }

  await Promise.all(
    [...porEixo.entries()].map(async ([axisId, itensDoEixo]) => {
      const eixo = plano.axes.find((axis) => axis.id === axisId);
      if (!eixo || eixo.reviewerIds.length === 0) return;
      const responsaveis = await usuarioRepository.listarPorIds(eixo.reviewerIds);
      if (responsaveis.length === 0) return;

      const link = `${env.FRONTEND_URL}/#/validacoes`;
      const plural = itensDoEixo.length > 1;
      const listaHtml = itensDoEixo.map((item) => `<li>${item.code} — ${item.title}</li>`).join("");
      const listaTexto = itensDoEixo.map((item) => `- ${item.code} — ${item.title}`).join("\n");
      const assunto = `SUMI — ${itensDoEixo.length} iniciativa${plural ? "s" : ""} aguardando validação no eixo ${eixo.code}`;

      await Promise.all(
        responsaveis.map((responsavel) =>
          mailer
            .enviar({
              to: responsavel.email,
              subject: assunto,
              html: `<p>Olá, ${responsavel.nome}.</p><p>${plural ? `${itensDoEixo.length} iniciativas foram enviadas` : "Uma iniciativa foi enviada"} para validação no eixo ${eixo.code} · ${eixo.name}:</p><ul>${listaHtml}</ul><p><a href="${link}">Ver validações pendentes</a></p>`,
              text: `${plural ? `${itensDoEixo.length} iniciativas foram enviadas` : "Uma iniciativa foi enviada"} para validação no eixo ${eixo.code} · ${eixo.name}:\n${listaTexto}\n\nVer validações pendentes: ${link}`,
            })
            .catch((err) => logger.error({ err, usuarioId: responsavel.id }, "Falha ao enviar e-mail de notificação de submissão")),
        ),
      );
    }),
  );
}

async function salvarItem(
  sessao: SessaoUsuario,
  plano: Plan,
  atual: NoPlanoRow | undefined,
  item: Item,
  contadorItensPorObjetivo: Map<string, number>,
  contexto: {
    indicadorAntigo?: Record<string, unknown>;
    acoesAntigas: Record<string, unknown>[];
    etapasAntigasPorAcao: Map<string, Record<string, unknown>[]>;
    resultadosAntigos: Record<string, unknown>[];
    riscosAntigos: Record<string, unknown>[];
    historicoAntigo: Record<string, unknown>[];
  },
): Promise<void> {
  const recurso = recursoDoItem(plano.id, item.axisId, item.id);
  const dadosAntigos = atual
    ? (atual.dados as Partial<Item> & { extras?: Record<string, string> })
    : { code: "", title: "", owner: "", partners: "", description: "", source: "", reviewStatus: "draft" as const, reviewNote: "", extras: {} };

  const dadosNovos = {
    code: item.code,
    title: item.title,
    owner: item.owner,
    partners: item.partners,
    description: item.description,
    source: item.source,
    reviewStatus: item.reviewStatus,
    reviewNote: item.reviewNote,
    linkedPlan: item.linkedPlan,
    extras: item.extras,
  };

  const conteudoBasicoMudou = diferente(
    { ...dadosAntigos, reviewStatus: undefined, reviewNote: undefined },
    { ...dadosNovos, reviewStatus: undefined, reviewNote: undefined },
  );

  if (!atual) {
    exigir(pode(sessao, "item.edit", recurso), `Sem permissão para criar o item "${item.code}"`);
  } else if (conteudoBasicoMudou) {
    exigir(pode(sessao, "item.edit", recurso), `Sem permissão para editar o item "${item.code}"`);
  }

  // Metas do indicador (targets) têm permissão própria; o restante do
  // indicador (nome/modo/unidade/...) segue a mesma trilha de item.edit.
  const metasAntigas = contexto.indicadorAntigo?.metas ?? {};
  if (diferente(metasAntigas, item.metric.targets)) {
    exigir(pode(sessao, "indicator.edit_target", recurso), `Sem permissão para editar as metas do item "${item.code}"`);
  }
  const indicadorSemMetasMudou =
    !contexto.indicadorAntigo ||
    diferente(
      { ...contexto.indicadorAntigo, metas: undefined, no_plano_id: undefined, atualizado_em: undefined },
      { nome: item.metric.name, modo_medicao: item.metric.measurementMode, tipo_valor: item.metric.valueType, unidade: item.metric.unit, periodicidade: item.metric.periodicity, linha_base: item.metric.baseline, referencia: item.metric.reference, direcao: item.metric.direction, formula: item.metric.formula, valor_concluido: item.metric.completedValue ?? null, metas: undefined },
    );
  if (indicadorSemMetasMudou) {
    exigir(pode(sessao, "item.edit", recurso), `Sem permissão para editar o indicador do item "${item.code}"`);
  }

  // Ações: criar/remover ação, ou editar os campos da própria ação, exige
  // action.manage (administrador). Etapas são mais permissivas — o Plano de
  // Negócio dá ao Responsável Técnico do Eixo "cadastrar e alterar etapas": adicionar
  // uma etapa nova a uma ação já existente, ou mudar status/justificativa/
  // parceiros de uma etapa existente, exige só stage.update. Remover etapa
  // ou mudar o título de uma etapa já existente continua exigindo
  // action.manage (não é "cadastrar", é reestruturar).
  const acoesAntigasPorId = new Map(contexto.acoesAntigas.map((row) => [row.id as string, row]));
  const idsAcoesNovas = new Set(item.actions.map((action) => action.id));
  let estruturaAcoesMudou = contexto.acoesAntigas.length !== item.actions.length;
  let novaEtapaMudou = false;
  let statusEtapaMudou = false;
  for (const action of item.actions) {
    const acaoAntiga = acoesAntigasPorId.get(action.id);
    if (!acaoAntiga) {
      estruturaAcoesMudou = true;
      continue;
    }
    if (diferente({ codigo: acaoAntiga.codigo, titulo: acaoAntiga.titulo, responsavel: acaoAntiga.responsavel, prazo: acaoAntiga.prazo }, { codigo: action.code, titulo: action.title, responsavel: action.owner, prazo: action.deadline || null })) {
      estruturaAcoesMudou = true;
    }
    const etapasAntigas = contexto.etapasAntigasPorAcao.get(action.id) ?? [];
    const etapasAntigasPorId = new Map(etapasAntigas.map((row) => [row.id as string, row]));
    if (etapasAntigas.length > action.tasks.length) estruturaAcoesMudou = true; // etapa removida
    else if (etapasAntigas.length < action.tasks.length) novaEtapaMudou = true; // etapa(s) nova(s)
    for (const task of action.tasks) {
      const etapaAntiga = etapasAntigasPorId.get(task.id);
      if (!etapaAntiga) continue; // já contabilizado acima (novaEtapaMudou)
      if (etapaAntiga.titulo !== task.title) estruturaAcoesMudou = true;
      if (etapaAntiga.situacao !== task.status || etapaAntiga.justificativa !== task.justification || etapaAntiga.parceiros !== task.partners) {
        statusEtapaMudou = true;
      }
    }
  }
  for (const acaoAntiga of contexto.acoesAntigas) {
    if (!idsAcoesNovas.has(acaoAntiga.id as string)) estruturaAcoesMudou = true;
  }
  if (estruturaAcoesMudou) {
    exigir(pode(sessao, "action.manage", recurso), `Sem permissão para alterar ações/etapas do item "${item.code}"`);
  } else if (novaEtapaMudou || statusEtapaMudou) {
    exigir(pode(sessao, "stage.update", recurso), `Sem permissão para cadastrar ou atualizar etapas do item "${item.code}"`);
  }

  // Resultados: só é possível adicionar (frontend nunca remove) — exige result.create.
  if (item.measurements.length > contexto.resultadosAntigos.length) {
    exigir(pode(sessao, "result.create", recurso), `Sem permissão para registrar resultados do item "${item.code}"`);
  } else if (diferente(contexto.resultadosAntigos.map((row) => row.id), item.measurements.map((measurement) => measurement.id))) {
    exigir(pode(sessao, "result.create", recurso), `Sem permissão para alterar resultados do item "${item.code}"`);
  }

  // Riscos: qualquer alteração exige risk.manage.
  const riscosAntigosComparaveis = contexto.riscosAntigos.map((row) => ({
    id: row.id,
    eixo: row.eixo,
    objetivo: row.objetivo,
    refIniciativa: row.ref_iniciativa,
    iniciativa: row.iniciativa,
    refAcao: row.ref_acao,
    acao: row.acao_estrategica,
    idRisco: row.id_risco,
    actionId: row.acao_id,
    stage: row.etapa_nome,
    title: row.titulo,
    probability: row.probabilidade,
    impact: row.impacto,
    owner: row.responsavel,
    strategicRisk: row.risco_estrategico,
    cause: row.causa,
    consequence: row.consequencia,
    category: row.categoria,
    controls: row.controles,
    controlType: row.tipo_controle,
    maturity: row.maturidade,
    response: row.resposta,
    treatment: row.tratamento,
    treatmentOwner: row.responsavel_tratamento,
    prazoInicio: row.prazo_inicio,
    deadline: row.prazo,
    custoPrevisto: row.custo_previsto == null ? null : Number(row.custo_previsto),
    execution: Number(row.execucao ?? 0),
    etapaConcluida: row.etapa_concluida,
    dataInicioReal: row.data_inicio_real,
    dataConclusaoReal: row.data_conclusao_real,
    situation: row.situacao,
    justificativa: row.justificativa,
    review: row.revisao,
    dataProximaRevisao: row.data_proxima_revisao,
    mudancaProcesso: row.mudanca_processo,
    novosRiscos: row.novos_riscos,
    acoesCorretivas: row.acoes_corretivas,
    licoesAprendidas: row.licoes_aprendidas,
    status: row.status,
  }));
  const riscosNovosComparaveis = item.risks.map((risk) => ({
    ...risk,
    eixo: risk.eixo ?? "",
    objetivo: risk.objetivo ?? "",
    refIniciativa: risk.refIniciativa ?? "",
    iniciativa: risk.iniciativa ?? "",
    refAcao: risk.refAcao ?? "",
    acao: risk.acao ?? "",
    idRisco: risk.idRisco ?? "",
    prazoInicio: risk.prazoInicio ?? "",
    deadline: risk.deadline || null,
    custoPrevisto: risk.custoPrevisto ?? null,
    etapaConcluida: risk.etapaConcluida ?? "",
    dataInicioReal: risk.dataInicioReal ?? "",
    dataConclusaoReal: risk.dataConclusaoReal ?? "",
    justificativa: risk.justificativa ?? "",
    dataProximaRevisao: risk.dataProximaRevisao ?? "",
    mudancaProcesso: risk.mudancaProcesso ?? "",
    novosRiscos: risk.novosRiscos ?? "",
    acoesCorretivas: risk.acoesCorretivas ?? "",
    licoesAprendidas: risk.licoesAprendidas ?? "",
  }));
  const riscosParaPersistir = prepareRiskWrite({
    existing: riscosAntigosComparaveis, submitted: riscosNovosComparaveis,
    canRead: pode(sessao, "risk.read", recurso), canManage: pode(sessao, "risk.manage", recurso),
    changed: diferente(riscosAntigosComparaveis, riscosNovosComparaveis),
    actionIds: new Set(item.actions.map((action) => action.id)), itemCode: item.code,
  });

  // Histórico: só é possível adicionar (frontend nunca edita/remove entradas existentes) — exige history.comment.
  const historicoIdsExistentes = new Set(contexto.historicoAntigo.map((entry) => entry.id));
  const novasEntradasHistorico = item.history.filter((entry) => !historicoIdsExistentes.has(entry.id));
  if (novasEntradasHistorico.length > 0) {
    exigir(pode(sessao, "history.comment", recurso), `Sem permissão para comentar no histórico do item "${item.code}"`);
  }
  const historicoParaPersistir = pode(sessao, "history.read", recurso) ? item.history : [
    ...contexto.historicoAntigo.map((entry) => ({ id: entry.id, at: entry.em, text: entry.texto, actor: entry.autor })),
    ...novasEntradasHistorico,
  ];

  if (dadosAntigos.reviewStatus !== item.reviewStatus) {
    if (item.reviewStatus === "submitted") {
      exigir(pode(sessao, "item.submit", recurso), `Sem permissão para enviar o item "${item.code}" para validação`);
    } else if (item.reviewStatus === "validated" || item.reviewStatus === "changes_requested") {
      exigir(pode(sessao, "item.review", recurso), `Sem permissão para validar o item "${item.code}"`);
    }
    // reviewStatus === "draft": efeito colateral automático de outra edição já autorizada acima.
  }

  const ordem = contadorItensPorObjetivo.get(item.objectiveId) ?? 0;
  contadorItensPorObjetivo.set(item.objectiveId, ordem + 1);
  await noPlanoRepo.upsertLote([
    { id: item.id, tipoPlanoId: plano.template.id, noPaiId: item.objectiveId, nivel: 2, ordem, dados: dadosNovos },
  ]);

  await indicadorRepo.upsertLote([
    {
      no_plano_id: item.id,
      nome: item.metric.name,
      modo_medicao: item.metric.measurementMode,
      tipo_valor: item.metric.valueType,
      unidade: item.metric.unit,
      periodicidade: item.metric.periodicity,
      linha_base: item.metric.baseline,
      referencia: item.metric.reference,
      direcao: item.metric.direction,
      metas: item.metric.targets,
      formula: item.metric.formula,
      valor_concluido: item.metric.completedValue ?? null,
    },
  ]);

  // Etapas e resultados são apagados e recriados a cada save (mesmo quando só
  // outro campo do item mudou) e o "on delete cascade" da FK leva junto
  // qualquer anexo vinculado — por isso capturamos os anexos existentes antes
  // de apagar e restauramos os que sobreviverem (mesmo id) depois de recriar.
  const anexosAntesDoSave = await anexoRepo.listarPorItem(item.id);

  await resultadoRepo.removerPorItens([item.id]);
  await resultadoRepo.inserirLote(
    item.measurements.map((measurement) => ({
      id: measurement.id,
      no_plano_id: item.id,
      ano: measurement.year,
      valor: measurement.value,
      observacao: measurement.note,
      em: measurement.at,
      evidencia: measurement.evidence,
    })),
  );

  await acaoRepo.removerPorItens([item.id]); // cascata remove etapa e zera risco.acao_id (on delete set null)
  await acaoRepo.inserirLote(
    item.actions.map((action, index) => ({
      id: action.id,
      no_plano_id: item.id,
      codigo: action.code,
      titulo: action.title,
      responsavel: action.owner,
      prazo: action.deadline || null,
      ordem: index,
    })),
  );
  await etapaRepo.inserirLote(
    item.actions.flatMap((action, actionIndex) =>
      action.tasks.map((task, taskIndex) => ({
        id: task.id,
        acao_id: action.id,
        titulo: task.title,
        situacao: task.status,
        prazo: task.deadline || null,
        justificativa: task.justification,
        parceiros: task.partners,
        ordem: actionIndex * 1000 + taskIndex,
      })),
    ),
  );

  const etapaIdsNovas = new Set(item.actions.flatMap((action) => action.tasks.map((task) => task.id)));
  const resultadoIdsNovas = new Set(item.measurements.map((measurement) => measurement.id));
  const anexosParaRestaurar = anexosAntesDoSave.filter(
    (anexo) => (anexo.etapa_id && etapaIdsNovas.has(anexo.etapa_id)) || (anexo.resultado_id && resultadoIdsNovas.has(anexo.resultado_id)),
  );
  await anexoRepo.recriarLote(anexosParaRestaurar);

  await riscoRepo.removerPorItens([item.id]);
  await riscoRepo.inserirLote(
    riscosParaPersistir.map((risk) => ({
      id: risk.id,
      no_plano_id: item.id,
      eixo: risk.eixo,
      objetivo: risk.objetivo,
      ref_iniciativa: risk.refIniciativa,
      iniciativa: risk.iniciativa,
      ref_acao: risk.refAcao,
      acao_estrategica: risk.acao,
      id_risco: risk.idRisco,
      acao_id: risk.actionId,
      etapa_nome: risk.stage,
      titulo: risk.title,
      probabilidade: risk.probability,
      impacto: risk.impact,
      responsavel: risk.owner,
      risco_estrategico: risk.strategicRisk,
      causa: risk.cause,
      consequencia: risk.consequence,
      categoria: risk.category,
      controles: risk.controls,
      tipo_controle: risk.controlType,
      maturidade: risk.maturity,
      resposta: risk.response,
      tratamento: risk.treatment,
      responsavel_tratamento: risk.treatmentOwner,
      prazo_inicio: risk.prazoInicio || null,
      prazo: risk.deadline || null,
      custo_previsto: risk.custoPrevisto,
      execucao: risk.execution,
      etapa_concluida: risk.etapaConcluida,
      data_inicio_real: risk.dataInicioReal || null,
      data_conclusao_real: risk.dataConclusaoReal || null,
      situacao: risk.situation,
      justificativa: risk.justificativa,
      revisao: risk.review,
      data_proxima_revisao: risk.dataProximaRevisao || null,
      mudanca_processo: risk.mudancaProcesso,
      novos_riscos: risk.novosRiscos,
      acoes_corretivas: risk.acoesCorretivas,
      licoes_aprendidas: risk.licoesAprendidas,
      status: risk.status,
    })),
  );

  await historicoRepo.removerPorItens([item.id]);
  await historicoRepo.inserirLote(
    historicoParaPersistir.map((entry) => ({ id: entry.id, no_plano_id: item.id, em: entry.at, texto: entry.text, autor: entry.actor })),
  );
}
