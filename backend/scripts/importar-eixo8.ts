/**
 * Importa o conteúdo real do Eixo 8 do PDI (planilha "Monitoramento Eixo 8 —
 * SEPLAN.xlsx", extraída para backend/scripts/data/eixo8-monitoramento-pdi.json)
 * para o plano PDI já criado por `pnpm --filter backend seed`.
 *
 * Idempotente: roda de novo sem duplicar — objetivos e itens são casados
 * pelo próprio código (ex.: "8.1", "8.1.3") dentro do eixo/objetivo correto;
 * indicador/ações/etapas/riscos de um item são sempre substituídos por
 * completo (mesmo padrão do PUT /api/v1/planning/workspace).
 *
 * Uso: pnpm --filter backend seed && pnpm --filter backend importar-eixo8
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { supabase } from "../src/lib/supabase.js";
import { acaoRepo, etapaRepo, indicadorRepo, resultadoRepo, riscoRepo } from "../src/modules/planning/planning.repository.js";

interface DadosEixo8 {
  axisCode: string;
  axisName: string;
  ownerUnit: string;
  objectives: { code: string; title: string }[];
  items: {
    code: string;
    objectiveCode: string;
    title: string;
    metric: {
      name: string;
      measurementMode: "manual" | "stages";
      valueType: "number" | "percentage";
      unit: string;
      baseline: number | null;
      direction: "up" | "down";
      targets: Record<string, number | null>;
      formula: string;
    };
    actions: {
      code: string;
      title: string;
      owner: string;
      deadline: string;
      tasks: { title: string; status: string; deadline: string; justification: string; partners: string }[];
    }[];
    risks?: {
      actionCode: string;
      stage: string;
      title: string;
      probability: number;
      impact: number;
      owner: string;
      strategicRisk: string;
      cause: string;
      consequence: string;
      category: string;
      controls: string;
      controlType: string;
      maturity: string;
      response: string;
      treatment: string;
      treatmentOwner: string;
      deadline: string;
      execution: number;
      situation: string;
      review: string;
      status: string;
    }[];
  }[];
}

async function buscarNoPorCodigo(noPaiId: string, nivel: number, codigo: string): Promise<string | null> {
  const { data, error } = await supabase.from("no_plano").select("id, dados").eq("no_pai_id", noPaiId).eq("nivel", nivel);
  if (error) throw error;
  const encontrado = (data as { id: string; dados: Record<string, unknown> }[]).find((row) => row.dados.code === codigo);
  return encontrado?.id ?? null;
}

async function upsertNoPorCodigo(input: {
  tipoPlanoId: string;
  noPaiId: string;
  nivel: number;
  codigo: string;
  ordem: number;
  dados: Record<string, unknown>;
}): Promise<string> {
  const existenteId = await buscarNoPorCodigo(input.noPaiId, input.nivel, input.codigo);
  if (existenteId) {
    const { error } = await supabase.from("no_plano").update({ dados: input.dados, ordem: input.ordem }).eq("id", existenteId);
    if (error) throw error;
    return existenteId;
  }
  const id = randomUUID();
  const { error } = await supabase
    .from("no_plano")
    .insert({ id, tipo_plano_id: input.tipoPlanoId, no_pai_id: input.noPaiId, nivel: input.nivel, ordem: input.ordem, dados: input.dados });
  if (error) throw error;
  return id;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const caminho = path.resolve(__dirname, "data/eixo8-monitoramento-pdi.json");
  const dados: DadosEixo8 = JSON.parse(readFileSync(caminho, "utf-8"));

  const { data: tipoPdi, error: erroTipo } = await supabase.from("tipo_plano").select("id").eq("tipo", "PDI").maybeSingle();
  if (erroTipo) throw erroTipo;
  if (!tipoPdi) throw new Error('Tipo de plano "PDI" não encontrado — rode `pnpm --filter backend seed` primeiro.');
  const tipoPlanoId = (tipoPdi as { id: string }).id;

  const { data: raizPdi, error: erroRaiz } = await supabase.from("no_plano").select("id").eq("tipo_plano_id", tipoPlanoId).eq("nivel", -1).limit(1).maybeSingle();
  if (erroRaiz) throw erroRaiz;
  if (!raizPdi) throw new Error("Plano PDI (nó raiz) não encontrado — rode `pnpm --filter backend seed` primeiro.");
  const planoId = (raizPdi as { id: string }).id;

  const eixoId = await buscarNoPorCodigo(planoId, 0, dados.axisCode);
  if (!eixoId) throw new Error(`Eixo "${dados.axisCode}" não encontrado sob o plano PDI — rode \`pnpm --filter backend seed\` primeiro.`);
  console.log(`Eixo ${dados.axisCode} (${dados.axisName}) localizado: ${eixoId}`);

  const idsObjetivos = new Map<string, string>();
  for (const [index, objetivo] of dados.objectives.entries()) {
    const id = await upsertNoPorCodigo({
      tipoPlanoId,
      noPaiId: eixoId,
      nivel: 1,
      codigo: objetivo.code,
      ordem: index,
      dados: { code: objetivo.code, title: objetivo.title },
    });
    idsObjetivos.set(objetivo.code, id);
    console.log(`  Objetivo ${objetivo.code} pronto (${id})`);
  }

  for (const [itemIndex, item] of dados.items.entries()) {
    const objetivoId = idsObjetivos.get(item.objectiveCode);
    if (!objetivoId) throw new Error(`objectiveCode "${item.objectiveCode}" não encontrado para o item "${item.code}"`);

    const itemId = await upsertNoPorCodigo({
      tipoPlanoId,
      noPaiId: objetivoId,
      nivel: 2,
      codigo: item.code,
      ordem: itemIndex,
      dados: {
        code: item.code,
        title: item.title,
        owner: dados.ownerUnit,
        partners: "",
        description: "",
        source: "PDI 2026–2030 · Monitoramento Eixo 8 (SEPLAN)",
        reviewStatus: "draft",
        reviewNote: "",
        extras: {},
      },
    });

    await indicadorRepo.upsertLote([
      {
        no_plano_id: itemId,
        nome: item.metric.name,
        modo_medicao: item.metric.measurementMode,
        tipo_valor: item.metric.valueType,
        unidade: item.metric.unit,
        periodicidade: "annual",
        linha_base: item.metric.baseline,
        referencia: "Linha de base do PDI 2026-2030",
        direcao: item.metric.direction,
        metas: item.metric.targets,
        formula: item.metric.formula,
        valor_concluido: null,
      },
    ]);

    await acaoRepo.removerPorItens([itemId]);
    await resultadoRepo.removerPorItens([itemId]);
    await riscoRepo.removerPorItens([itemId]);

    const idsAcoes = new Map<string, string>();
    const linhasAcao = item.actions.map((acao, index) => {
      const id = randomUUID();
      idsAcoes.set(acao.code, id);
      return { id, no_plano_id: itemId, codigo: acao.code, titulo: acao.title, responsavel: acao.owner, prazo: acao.deadline || null, ordem: index };
    });
    await acaoRepo.inserirLote(linhasAcao);

    await etapaRepo.inserirLote(
      item.actions.flatMap((acao, acaoIndex) =>
        acao.tasks.map((etapa, etapaIndex) => ({
          id: randomUUID(),
          acao_id: idsAcoes.get(acao.code),
          titulo: etapa.title,
          situacao: etapa.status,
          prazo: etapa.deadline || null,
          justificativa: etapa.justification,
          parceiros: etapa.partners,
          ordem: acaoIndex * 1000 + etapaIndex,
        })),
      ),
    );

    if (item.risks?.length) {
      await riscoRepo.inserirLote(
        item.risks.map((risco) => ({
          id: randomUUID(),
          no_plano_id: itemId,
          acao_id: idsAcoes.get(risco.actionCode) ?? null,
          etapa_nome: risco.stage,
          titulo: risco.title,
          probabilidade: risco.probability,
          impacto: risco.impact,
          responsavel: risco.owner,
          risco_estrategico: risco.strategicRisk,
          causa: risco.cause,
          consequencia: risco.consequence,
          categoria: risco.category,
          controles: risco.controls,
          tipo_controle: risco.controlType,
          maturidade: risco.maturity,
          resposta: risco.response,
          tratamento: risco.treatment,
          responsavel_tratamento: risco.treatmentOwner,
          prazo: risco.deadline || null,
          execucao: risco.execution,
          situacao: risco.situation,
          revisao: risco.review,
          status: risco.status,
        })),
      );
    }

    console.log(`  Item ${item.code} pronto: ${item.actions.length} ações, ${item.risks?.length ?? 0} riscos`);
  }

  console.log("Importação do Eixo 8 concluída.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
