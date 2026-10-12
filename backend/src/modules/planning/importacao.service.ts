/**
 * Importação/exportação de planilhas .xlsx de "Monitoramento do PDI" e
 * "Gerenciamento de Riscos" — as unidades já preenchem essas duas matrizes
 * fora do SUMI (um arquivo por eixo/unidade) e pediram uma forma de trazer
 * esse conteúdo para dentro do sistema sem redigitar tudo, além de um
 * modelo em branco para quem ainda não tem planilha própria.
 *
 * Formato: .xlsx (não CSV) porque o arquivo real usa mesclagem de célula
 * para representar a hierarquia Eixo → Objetivo → Iniciativa → Ação →
 * Etapa, tem duas abas com propósitos distintos (execução do PDI e matriz
 * de riscos) e se beneficia de validação de dados (dropdowns) no modelo
 * exportado — nada disso sobrevive em CSV.
 *
 * A aba de riscos segue um template institucional já padronizado (42
 * colunas, mesma ordem em todas as planilhas reais analisadas), então é
 * lida por posição. A aba de monitoramento do PDI varia um pouco de
 * cabeçalho entre unidades (nem toda planilha tem coluna de parceiro da
 * etapa, por exemplo), então é lida por nome de cabeçalho normalizado.
 *
 * A importação lê os itens já existentes (via montarWorkspace) e casa cada
 * linha pelo código (Ref. Iniciativa / Ref. Ação) dentro do eixo indicado —
 * igual ao scripts/importar-eixo8.ts — e delega a gravação para
 * salvarWorkspace, que já garante todas as permissões e validações do PUT
 * normal do workspace (nenhuma regra de autorização é duplicada aqui).
 */
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { HttpError } from "../../lib/http-error.js";
import type { SessaoUsuario } from "../auth/auth.types.js";
import { montarWorkspace, salvarWorkspace } from "./planning.service.js";
import { parseOrLancar, workspaceSchema } from "./planning.schema.js";
import type { ActionItem, HistoryEntry, Item, Objective, Risk } from "./planning.types.js";

import { lerAbaPdi, lerAbaRiscos } from "./importacao.leitura.js";
export { lerAbaPdi, lerAbaRiscos } from "./importacao.leitura.js";

// ---------------------------------------------------------------------------
// Histórico — cada iniciativa criada ou atualizada por importação registra
// uma entrada, mesmo sem diferença de conteúdo (reimportar é em si um evento
// relevante: confirma que alguém revisou/atualizou a fonte). É o único jeito
// de deixar rastro dessa operação: diferente de uma edição manual pela tela
// (onde o history já vem pronto do cliente em changeItem), a importação
// nunca passa pelo fluxo normal de edição — sem isso o item mudava de
// conteúdo sem nenhum registro de quando ou por quê.
// ---------------------------------------------------------------------------

function historyEntry(text: string, actor: string): HistoryEntry {
  return { id: randomUUID(), at: new Date().toISOString(), text, actor };
}

export function descreverAtualizacao(antes: Item, depois: Item): string[] {
  const mudancas: string[] = [];
  if (antes.title !== depois.title) mudancas.push(`título alterado para "${depois.title}"`);
  if (antes.metric.name !== depois.metric.name) mudancas.push(`indicador alterado para "${depois.metric.name}"`);
  if (antes.metric.baseline !== depois.metric.baseline) mudancas.push(`linha de base alterada para ${depois.metric.baseline ?? "—"}`);

  const anosMeta = Object.keys(depois.metric.targets).filter((ano) => antes.metric.targets[ano] !== depois.metric.targets[ano]);
  if (anosMeta.length) mudancas.push(`meta${anosMeta.length > 1 ? "s" : ""} de ${anosMeta.join(", ")} atualizada${anosMeta.length > 1 ? "s" : ""}`);

  if (depois.measurements.length > antes.measurements.length) {
    const anosNovos = depois.measurements.slice(antes.measurements.length).map((m) => m.year);
    mudancas.push(`execução de ${anosNovos.join(", ")} registrada`);
  }

  const acoesAntes = antes.actions.length;
  const acoesDepois = depois.actions.length;
  if (acoesDepois > acoesAntes) mudancas.push(`${acoesDepois - acoesAntes} ação${acoesDepois - acoesAntes > 1 ? "ões" : ""} nova${acoesDepois - acoesAntes > 1 ? "s" : ""}`);
  else if (acoesDepois < acoesAntes) mudancas.push(`${acoesAntes - acoesDepois} ação${acoesAntes - acoesDepois > 1 ? "ões" : ""} removida${acoesAntes - acoesDepois > 1 ? "s" : ""}`);

  const etapasAntes = antes.actions.reduce((total, a) => total + a.tasks.length, 0);
  const etapasDepois = depois.actions.reduce((total, a) => total + a.tasks.length, 0);
  if (etapasDepois !== etapasAntes) mudancas.push(`etapas: ${etapasAntes} → ${etapasDepois}`);

  const riscosAntes = antes.risks.length;
  const riscosDepois = depois.risks.length;
  if (riscosDepois !== riscosAntes) mudancas.push(`riscos: ${riscosAntes} → ${riscosDepois}`);

  return mudancas;
}

// ---------------------------------------------------------------------------
// Fusão com o workspace atual e gravação
// ---------------------------------------------------------------------------

export interface ResumoImportacao {
  eixo: string;
  itensCriados: number;
  itensAtualizados: number;
  acoesImportadas: number;
  etapasImportadas: number;
  riscosImportados: number;
  avisos: string[];
}

export async function importarPlanilha(sessao: SessaoUsuario, planId: string, buffer: Buffer): Promise<ResumoImportacao> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new HttpError(400, "Não foi possível ler o arquivo enviado — envie um .xlsx válido.");
  }

  const abaPdi = workbook.worksheets.find((ws) => /monitoramento/i.test(ws.name) && !/risco/i.test(ws.name));
  if (!abaPdi) throw new HttpError(400, 'Não encontrei uma aba de monitoramento do PDI (nome esperado: "<UNIDADE> - MONITORAMENTO PDI").');
  const abaRiscos = workbook.worksheets.find((ws) => /gerenciamento/i.test(ws.name) && /risco/i.test(ws.name));

  const eixoImportado = lerAbaPdi(abaPdi);
  const riscosImportados = abaRiscos ? lerAbaRiscos(abaRiscos) : [];
  if (!eixoImportado.eixoCodigo) throw new HttpError(400, "Não foi possível identificar o código do eixo na planilha (coluna \"Eixo\").");
  if (eixoImportado.itens.size === 0) throw new HttpError(400, "Nenhuma iniciativa reconhecida na planilha — confira se a linha de cabeçalho está intacta.");

  const workspace = await montarWorkspace(sessao);
  const plano = workspace.plans.find((p) => p.id === planId);
  if (!plano) throw new HttpError(404, `Plano "${planId}" não encontrado.`);
  const eixo = plano.axes.find((axis) => axis.code === eixoImportado.eixoCodigo);
  if (!eixo) {
    throw new HttpError(400, `O eixo "${eixoImportado.eixoCodigo}" (identificado na planilha) não existe neste plano — cadastre o eixo pela tela de Estrutura antes de importar.`);
  }

  const avisos: string[] = [];
  let itensCriados = 0;
  let itensAtualizados = 0;
  let acoesImportadas = 0;
  let etapasImportadas = 0;

  const objetivosDoEixo = plano.objectives.filter((o) => o.axisId === eixo.id);
  const itensDoEixo = plano.items.filter((i) => i.axisId === eixo.id);

  for (const importado of eixoImportado.itens.values()) {
    let objetivo = objetivosDoEixo.find((o) => o.code === importado.objetivoCodigo);
    if (!objetivo && importado.objetivoCodigo) {
      const novo: Objective = { id: randomUUID(), axisId: eixo.id, code: importado.objetivoCodigo, title: importado.objetivoTitulo || importado.objetivoCodigo };
      plano.objectives.push(novo);
      objetivosDoEixo.push(novo);
      objetivo = novo;
    }
    if (!objetivo) {
      avisos.push(`Iniciativa ${importado.itemCodigo}: sem objetivo identificado na planilha — ignorada.`);
      continue;
    }

    const itemExistente = itensDoEixo.find((i) => i.code === importado.itemCodigo);
    const ehValorPercentual = /%/.test(importado.linhaBase) || Object.values(importado.metas).some((v) => /%/.test(v));
    const limpar = (texto: string) => (texto === "-" || texto === "" ? null : texto.replace("%", "").replace(",", ".").trim());
    const paraNumero = (texto: string | null) => (texto == null ? null : Number.isNaN(Number(texto)) ? texto : Number(texto));

    const acoes: ActionItem[] = [];
    for (const [codigo, dadosAcao] of importado.acoes) {
      const acaoExistente = itemExistente?.actions.find((a) => a.code === codigo);
      acoes.push({
        id: acaoExistente?.id ?? randomUUID(),
        code: codigo,
        title: dadosAcao.titulo,
        owner: acaoExistente?.owner ?? "",
        deadline: acaoExistente?.deadline ?? "",
        tasks: dadosAcao.etapas,
      });
      acoesImportadas += 1;
      etapasImportadas += dadosAcao.etapas.length;
    }

    const anoComExecucao = Object.keys(importado.execucoes)[0];
    const measurements = itemExistente ? [...itemExistente.measurements] : [];
    if (anoComExecucao) {
      const valor = paraNumero(limpar(importado.execucoes[anoComExecucao] ?? ""));
      const jaTemNoAno = measurements.some((m) => m.year === Number(anoComExecucao));
      if (!jaTemNoAno && valor != null) {
        measurements.push({ id: randomUUID(), year: Number(anoComExecucao), value: valor, note: "Importado da planilha de monitoramento.", at: new Date().toISOString(), evidence: "" });
      }
    }

    const item: Item = {
      id: itemExistente?.id ?? randomUUID(),
      code: importado.itemCodigo,
      axisId: eixo.id,
      objectiveId: objetivo.id,
      title: importado.itemTitulo || itemExistente?.title || importado.itemCodigo,
      owner: itemExistente?.owner ?? eixo.ownerUnit,
      partners: itemExistente?.partners ?? "",
      description: itemExistente?.description ?? "",
      source: itemExistente?.source ?? "Importado de planilha de monitoramento do PDI.",
      reviewStatus: itemExistente?.reviewStatus ?? "draft",
      reviewNote: itemExistente?.reviewNote ?? "",
      linkedPlan: itemExistente?.linkedPlan,
      metric: {
        name: importado.indicador || itemExistente?.metric.name || "",
        measurementMode: itemExistente?.metric.measurementMode ?? "manual",
        valueType: itemExistente?.metric.valueType ?? (ehValorPercentual ? "percentage" : "number"),
        unit: itemExistente?.metric.unit ?? (ehValorPercentual ? "%" : ""),
        periodicity: itemExistente?.metric.periodicity ?? "annual",
        baseline: paraNumero(limpar(importado.linhaBase)) ?? itemExistente?.metric.baseline ?? null,
        reference: itemExistente?.metric.reference ?? "",
        direction: itemExistente?.metric.direction ?? "up",
        targets: { ...itemExistente?.metric.targets, ...Object.fromEntries(Object.entries(importado.metas).map(([ano, valor]) => [ano, paraNumero(limpar(valor))])) },
        formula: itemExistente?.metric.formula ?? "",
        completedValue: itemExistente?.metric.completedValue,
      },
      measurements,
      extras: itemExistente?.extras ?? {},
      actions: acoes,
      history: itemExistente?.history ?? [],
      risks: [],
    };

    const riscosDoItem = riscosImportados.filter((r) => r.itemCodigo === item.code);
    item.risks = riscosDoItem.map((r): Risk => {
      const acao = item.actions.find((a) => a.code === r.acaoCodigo);
      if (!acao) {
        avisos.push(`Risco "${r.titulo}" (item ${item.code}): ação "${r.acaoCodigo}" não encontrada — risco ignorado.`);
        return null as unknown as Risk;
      }
      return {
        id: randomUUID(),
        actionId: acao.id,
        stage: r.etapa,
        title: r.titulo,
        probability: r.probabilidade,
        impact: r.impacto,
        owner: r.treatmentOwner,
        strategicRisk: r.riscoEstrategico,
        cause: r.causa,
        consequence: r.consequencia,
        category: r.categoria,
        controls: r.controles,
        controlType: r.tipoControle,
        maturity: r.maturidade,
        response: r.resposta,
        treatment: r.tratamento,
        treatmentOwner: r.treatmentOwner,
        deadline: r.prazo,
        execution: r.execucao,
        situation: r.situacao,
        review: r.review,
        status: r.status,
      };
    }).filter((r): r is Risk => r !== null);

    const autor = sessao.user?.name ?? "Importação de planilha";
    if (itemExistente) {
      const mudancas = descreverAtualizacao(itemExistente, item);
      const texto = mudancas.length
        ? `Atualizado pela importação da planilha (Eixo ${eixo.code}): ${mudancas.join("; ")}.`
        : `Planilha reimportada (Eixo ${eixo.code}) sem alterações de conteúdo.`;
      item.history = [...itemExistente.history, historyEntry(texto, autor)];
      const index = plano.items.findIndex((i) => i.id === itemExistente.id);
      plano.items[index] = item;
      itensAtualizados += 1;
    } else {
      item.history = [historyEntry(`Iniciativa criada pela importação da planilha de monitoramento (Eixo ${eixo.code}).`, autor)];
      plano.items.push(item);
      itensDoEixo.push(item);
      itensCriados += 1;
    }
  }

  const workspaceValidado = parseOrLancar(workspaceSchema, workspace);
  await salvarWorkspace(sessao, workspaceValidado);

  return {
    eixo: `${eixo.code} · ${eixo.name}`,
    itensCriados,
    itensAtualizados,
    acoesImportadas,
    etapasImportadas,
    riscosImportados: riscosImportados.length,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Modelo em branco para download
// ---------------------------------------------------------------------------

const PDI_CABECALHOS = [
  "Eixo", "Objetivo do PDI", "Ref. Iniciativa", "Iniciativa", "Indicador da Iniciativa", "Linha de Base",
  "Meta 2026", "Meta 2027", "Meta 2028", "Meta 2029", "Meta 2030",
  "Ref. Ação", "Ação Estratégica", "Etapa (Tarefa)", "Parceiro na etapa", "Etapa concluída (sim/não)?", "Execução (2026)", "Justificativas",
];

const RISCO_CABECALHOS = [
  "Eixo", "Objetivo do PDI", "Ref. Iniciativa", "Iniciativa", "Ref. Ação", "Ação Estratégica", "Etapa (Tarefa)",
  "Risco Estratégico (da iniciativa)", "ID Risco (etapa)", "Risco do Processo (da etapa)", "Causa do Risco", "Efeito / Consequência", "Categoria do Risco",
  "Probabilidade (P) 1 a 5", "Impacto (I) 1 a 5", "Risco Inerente (RI = P × I)", "Nível do RI",
  "Controles Existentes", "Tipo de Controle", "Maturidade", "Fator de Controle (FC)", "Risco Residual (RR = RI × FC)", "Nível do RR",
  "Resposta ao Risco", "Plano de Tratamento (Contramedidas)", "Responsável pelo Tratamento", "Prazo Início", "Prazo Conclusão", "Custo Previsto",
  "% Execução", "Etapa Concluída?", "Data de Início Real", "Data de Conclusão Real", "Situação",
  "Justificativa / Observações", "Status do Risco", "Frequência de Revisão", "Data da Próxima Revisão",
  "Houve mudança no processo?", "Novos riscos identificados?", "Ações Corretivas", "Lições Aprendidas",
];

const EXEMPLO_PDI = ["3", "Objetivo 3.5: Expandir a Editora da UFCG", "3.5.1", "Regulamentar a EDUFCG", "Numérico = Nº de ações", 0, 1, "-", "-", "-", "-", "3.5.1.1", "Elaborar a proposta de Resolução", "Constituir comissão de elaboração", "Reitoria", "não", "", ""];
const EXEMPLO_RISCO = [
  "3", "Objetivo 3.5: Expandir a Editora da UFCG", "3.5.1", "Regulamentar a EDUFCG", "3.5.1.1", "Elaborar a proposta de Resolução", "Constituir comissão de elaboração",
  "A EDUFCG operar sem marco regulatório próprio", "R-3.5.1.1.01", "Composição da comissão sem representatividade", "Falta de critério prévio de composição", "Comissão pouco representativa", "Operacional",
  3, 3, "", "", "Estatuto e Regimento Geral da UFCG", "Preventivo", "Fraco", "", "", "",
  "Mitigar", "Designar comissão por portaria com critérios definidos", "Reitoria", "2026-02-01", "2026-04-30", "Sem custo direto",
  "", "não", "", "", "Não iniciado",
  "", "Ativo", "Trimestral", "",
  "", "", "", "",
];

function estilizarCabecalho(planilha: ExcelJS.Worksheet, linha: number, quantidadeColunas: number) {
  const row = planilha.getRow(linha);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5F8A" } };
  row.alignment = { vertical: "middle", wrapText: true };
  for (let c = 1; c <= quantidadeColunas; c++) planilha.getColumn(c).width = 24;
  row.height = 32;
}

function aplicarValidacaoLista(planilha: ExcelJS.Worksheet, coluna: number, linhaInicio: number, linhaFim: number, opcoes: string[]) {
  const formula = `"${opcoes.join(",")}"`;
  for (let linha = linhaInicio; linha <= linhaFim; linha++) {
    planilha.getCell(linha, coluna).dataValidation = { type: "list", allowBlank: true, formulae: [formula] };
  }
}

export async function gerarModeloXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SUMI · UFCG";
  workbook.created = new Date();

  const abaPdi = workbook.addWorksheet("MONITORAMENTO PDI");
  abaPdi.addRow(PDI_CABECALHOS);
  estilizarCabecalho(abaPdi, 1, PDI_CABECALHOS.length);
  abaPdi.addRow(EXEMPLO_PDI).font = { italic: true, color: { argb: "FF888888" } };
  const LINHA_FIM_MODELO = 500;
  aplicarValidacaoLista(abaPdi, PDI_CABECALHOS.indexOf("Etapa concluída (sim/não)?") + 1, 3, LINHA_FIM_MODELO, ["sim", "não"]);
  abaPdi.views = [{ state: "frozen", ySplit: 1 }];

  const abaRiscos = workbook.addWorksheet("GERENCIAMENTO DE RISCOS");
  abaRiscos.addRow(RISCO_CABECALHOS);
  estilizarCabecalho(abaRiscos, 1, RISCO_CABECALHOS.length);
  abaRiscos.addRow(EXEMPLO_RISCO).font = { italic: true, color: { argb: "FF888888" } };
  abaRiscos.views = [{ state: "frozen", ySplit: 1 }];
  aplicarValidacaoLista(abaRiscos, RISCO_CABECALHOS.indexOf("Probabilidade (P) 1 a 5") + 1, 3, LINHA_FIM_MODELO, ["1", "2", "3", "4", "5"]);
  aplicarValidacaoLista(abaRiscos, RISCO_CABECALHOS.indexOf("Impacto (I) 1 a 5") + 1, 3, LINHA_FIM_MODELO, ["1", "2", "3", "4", "5"]);
  aplicarValidacaoLista(abaRiscos, RISCO_CABECALHOS.indexOf("Tipo de Controle") + 1, 3, LINHA_FIM_MODELO, ["Preventivo", "Detectivo", "Corretivo"]);
  aplicarValidacaoLista(abaRiscos, RISCO_CABECALHOS.indexOf("Maturidade") + 1, 3, LINHA_FIM_MODELO, ["Inexistente", "Fraco", "Mediano", "Forte"]);
  aplicarValidacaoLista(abaRiscos, RISCO_CABECALHOS.indexOf("Resposta ao Risco") + 1, 3, LINHA_FIM_MODELO, ["Aceitar", "Mitigar", "Transferir", "Evitar"]);
  aplicarValidacaoLista(abaRiscos, RISCO_CABECALHOS.indexOf("Etapa Concluída?") + 1, 3, LINHA_FIM_MODELO, ["sim", "não"]);

  const instrucoes = workbook.addWorksheet("Instruções", { properties: { tabColor: { argb: "FFB8860B" } } });
  instrucoes.columns = [{ width: 100 }];
  [
    "Como preencher este modelo",
    "",
    "1. Preencha a aba MONITORAMENTO PDI com uma linha por Etapa (Tarefa). Eixo, Objetivo, Iniciativa e Ação podem ficar em branco nas linhas seguintes de uma mesma iniciativa/ação — o SUMI repete o valor da linha anterior.",
    "2. Os códigos de referência (Ref. Iniciativa, Ref. Ação) são a chave usada para casar com o que já existe no SUMI: se o código já existir no eixo, a linha atualiza o item existente; se não existir, cria um novo.",
    "3. Preencha a aba GERENCIAMENTO DE RISCOS do mesmo jeito, uma linha por risco. O Ref. Ação de cada risco precisa corresponder a uma ação já descrita na aba de monitoramento.",
    "4. O eixo informado na coluna \"Eixo\" precisa já existir no plano dentro do SUMI (cadastrado pela tela de Estrutura) — a importação não cria eixos novos.",
    "5. Suba o arquivo preenchido pelo botão \"Importar planilha\", na mesma tela onde baixou este modelo.",
    "",
    "Limitações desta primeira versão da importação:",
    "- Os campos Risco Inerente/Residual, Fator de Controle, datas reais de execução e o bloco de revisão periódica (frequência, próxima revisão, lições aprendidas) ainda não são gravados no SUMI — ficam só nesta planilha, como registro do preenchimento original.",
    "- O responsável de cada etapa (quando a planilha não tem coluna de parceiro) é importado como parceiro da etapa.",
    "- \"Execução (ano)\" é interpretado como o resultado do indicador daquele ano.",
  ].forEach((linha) => instrucoes.addRow([linha]));
  instrucoes.getRow(1).font = { bold: true, size: 14 };
  instrucoes.getRow(9).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
