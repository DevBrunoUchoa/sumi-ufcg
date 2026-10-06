/** Leitura de XLSX sem dependências de sessão, banco ou configuração de ambiente. */
import { randomUUID } from "node:crypto";
import type ExcelJS from "exceljs";
import { HttpError } from "../../lib/http-error.js";
import type { Stage } from "./planning.types.js";

// ---------------------------------------------------------------------------
// Normalização e casamento de cabeçalho
// ---------------------------------------------------------------------------

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

function valorCelula(valor: ExcelJS.CellValue): string {
  if (valor == null) return "";
  if (valor instanceof Date) return formatarData(valor);
  if (typeof valor === "object") {
    if ("richText" in valor && Array.isArray((valor as { richText: { text: string }[] }).richText)) {
      return (valor as { richText: { text: string }[] }).richText.map((parte) => parte.text).join("");
    }
    if ("text" in valor) return String((valor as { text: unknown }).text ?? "");
    if ("result" in valor) return String((valor as { result: unknown }).result ?? "");
  }
  return String(valor).trim();
}

function formatarData(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function extrairCodigo(texto: string): string {
  const m = texto.match(/(\d+(?:\.\d+)*)/);
  return m?.[1] ?? texto.trim();
}

/** "Eixo 3: Extensão" | "3: Extensão" | "Extensão" (sem código) -> "3" */
function extrairCodigoEixo(texto: string): string {
  const m = texto.match(/^\s*(?:eixo\s*)?(\d+)/i);
  return m?.[1] ?? "";
}

// ---------------------------------------------------------------------------
// Leitura da aba "MONITORAMENTO PDI"
// ---------------------------------------------------------------------------

const PDI_CAMPOS: { chave: string; padroes: string[] }[] = [
  { chave: "eixo", padroes: ["eixo"] },
  { chave: "objetivo", padroes: ["objetivo do pdi", "objetivo"] },
  { chave: "itemCodigo", padroes: ["ref iniciativa"] },
  { chave: "itemTitulo", padroes: ["iniciativa"] },
  { chave: "indicador", padroes: ["indicador da iniciativa", "indicador"] },
  { chave: "linhaBase", padroes: ["linha de base"] },
  { chave: "acaoCodigo", padroes: ["ref acao"] },
  { chave: "acaoTitulo", padroes: ["acao estrategica", "acao"] },
  { chave: "etapa", padroes: ["etapa tarefa", "etapa"] },
  { chave: "parceiros", padroes: ["parceiro"] },
  { chave: "etapaConcluida", padroes: ["etapa concluida"] },
  { chave: "responsavel", padroes: ["responsavel"] },
  { chave: "justificativa", padroes: ["justificativa"] },
];

interface ColunaPdi {
  indice: number;
  chave: string;
  ano?: number;
}

function mapearColunasPdi(cabecalhos: string[]): ColunaPdi[] {
  const usados = new Set<number>();
  const colunas: ColunaPdi[] = [];

  cabecalhos.forEach((cabecalho, indice) => {
    const norm = normalizar(cabecalho);
    if (!norm) return;
    const metaAno = norm.match(/^meta (\d{4})$/);
    if (metaAno) {
      colunas.push({ indice, chave: "meta", ano: Number(metaAno[1]) });
      usados.add(indice);
      return;
    }
    if (norm.startsWith("execucao")) {
      const ano = norm.match(/(\d{4})/);
      colunas.push({ indice, chave: "execucao", ano: ano ? Number(ano[1]) : undefined });
      usados.add(indice);
      return;
    }
  });

  for (const campo of PDI_CAMPOS) {
    for (const padrao of campo.padroes) {
      const achado = cabecalhos.findIndex((cabecalho, indice) => !usados.has(indice) && normalizar(cabecalho) === padrao);
      if (achado >= 0) {
        colunas.push({ indice: achado, chave: campo.chave });
        usados.add(achado);
        break;
      }
    }
  }
  // segunda passada, mais tolerante (substring), para cabeçalhos com variações não previstas
  for (const campo of PDI_CAMPOS) {
    if (colunas.some((coluna) => coluna.chave === campo.chave)) continue;
    for (const padrao of campo.padroes) {
      const achado = cabecalhos.findIndex((cabecalho, indice) => !usados.has(indice) && normalizar(cabecalho).includes(padrao));
      if (achado >= 0) {
        colunas.push({ indice: achado, chave: campo.chave });
        usados.add(achado);
        break;
      }
    }
  }
  return colunas;
}

interface ItemImportado {
  itemCodigo: string;
  itemTitulo: string;
  objetivoCodigo: string;
  objetivoTitulo: string;
  indicador: string;
  linhaBase: string;
  metas: Record<string, string>;
  execucoes: Record<string, string>;
  acoes: Map<string, { titulo: string; etapas: Stage[] }>;
}

interface EixoImportado {
  eixoCodigo: string;
  itens: Map<string, ItemImportado>;
}

export function lerAbaPdi(planilha: ExcelJS.Worksheet): EixoImportado {
  const linhaCabecalho = encontrarLinhaCabecalho(planilha, ["eixo", "objetivo"]);
  if (!linhaCabecalho) throw new HttpError(400, `Não encontrei a linha de cabeçalho na aba "${planilha.name}".`);
  const cabecalhos: string[] = [];
  planilha.getRow(linhaCabecalho).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cabecalhos[colNumber - 1] = valorCelula(cell.value);
  });
  const colunas = mapearColunasPdi(cabecalhos);
  const porChave = new Map<string, number>();
  const metas = new Map<number, number>(); // ano -> indice
  const execucoes = new Map<number, number>();
  for (const coluna of colunas) {
    if (coluna.chave === "meta" && coluna.ano) metas.set(coluna.ano, coluna.indice);
    else if (coluna.chave === "execucao" && coluna.ano) execucoes.set(coluna.ano, coluna.indice);
    else porChave.set(coluna.chave, coluna.indice);
  }

  const ler = (row: ExcelJS.Row, chave: string): string => {
    const indice = porChave.get(chave);
    if (indice == null) return "";
    return valorCelula(row.getCell(indice + 1).value);
  };

  const contexto = { eixoCodigo: "", objetivoCodigo: "", objetivoTitulo: "", itemCodigo: "", itemTitulo: "", indicador: "", linhaBase: "", acaoCodigo: "", acaoTitulo: "" };
  const itens = new Map<string, ItemImportado>();
  let eixoCodigo = "";

  for (let numeroLinha = linhaCabecalho + 1; numeroLinha <= planilha.rowCount; numeroLinha++) {
    const row = planilha.getRow(numeroLinha);
    if (row.actualCellCount === 0) continue;

    const eixoTexto = ler(row, "eixo") || contexto.eixoCodigo;
    if (eixoTexto) {
      const codigo = extrairCodigoEixo(eixoTexto);
      if (codigo) { eixoCodigo = codigo; contexto.eixoCodigo = eixoTexto; }
    }

    const objetivoTexto = ler(row, "objetivo");
    if (objetivoTexto) {
      contexto.objetivoCodigo = extrairCodigo(objetivoTexto);
      contexto.objetivoTitulo = objetivoTexto.replace(/^objetivo\s*/i, "").replace(/^\d+(?:\.\d+)*\s*:?\s*/, "").trim();
    }

    const itemCodigoTexto = ler(row, "itemCodigo");
    if (itemCodigoTexto) contexto.itemCodigo = extrairCodigo(itemCodigoTexto);
    const itemTituloTexto = ler(row, "itemTitulo");
    if (itemTituloTexto) contexto.itemTitulo = itemTituloTexto;
    const indicadorTexto = ler(row, "indicador");
    if (indicadorTexto) contexto.indicador = indicadorTexto;
    const linhaBaseTexto = ler(row, "linhaBase");
    if (linhaBaseTexto) contexto.linhaBase = linhaBaseTexto;
    const acaoCodigoTexto = ler(row, "acaoCodigo");
    if (acaoCodigoTexto) contexto.acaoCodigo = extrairCodigo(acaoCodigoTexto);
    const acaoTituloTexto = ler(row, "acaoTitulo");
    if (acaoTituloTexto) contexto.acaoTitulo = acaoTituloTexto;

    if (!contexto.itemCodigo || !contexto.acaoCodigo) continue; // linha fora de uma iniciativa/ação reconhecível

    let item = itens.get(contexto.itemCodigo);
    if (!item) {
      item = {
        itemCodigo: contexto.itemCodigo,
        itemTitulo: contexto.itemTitulo,
        objetivoCodigo: contexto.objetivoCodigo,
        objetivoTitulo: contexto.objetivoTitulo,
        indicador: contexto.indicador,
        linhaBase: contexto.linhaBase,
        metas: {},
        execucoes: {},
        acoes: new Map(),
      };
      itens.set(contexto.itemCodigo, item);
    }
    for (const [ano, indice] of metas) {
      const valor = valorCelula(row.getCell(indice + 1).value);
      if (valor) item.metas[ano] = valor;
    }
    for (const [ano, indice] of execucoes) {
      const valor = valorCelula(row.getCell(indice + 1).value);
      if (valor) item.execucoes[ano] = valor;
    }

    let acao = item.acoes.get(contexto.acaoCodigo);
    if (!acao) {
      acao = { titulo: contexto.acaoTitulo, etapas: [] };
      item.acoes.set(contexto.acaoCodigo, acao);
    }

    const etapaTitulo = ler(row, "etapa");
    if (etapaTitulo) {
      const concluida = normalizar(ler(row, "etapaConcluida"));
      acao.etapas.push({
        id: randomUUID(),
        title: etapaTitulo,
        status: concluida === "sim" ? "completed" : "not_started",
        deadline: "",
        justification: ler(row, "justificativa"),
        partners: ler(row, "parceiros") || ler(row, "responsavel"),
      });
    }
  }

  return { eixoCodigo, itens };
}

function encontrarLinhaCabecalho(planilha: ExcelJS.Worksheet, marcadores: string[]): number | null {
  for (let numeroLinha = 1; numeroLinha <= Math.min(planilha.rowCount, 10); numeroLinha++) {
    const valores: string[] = [];
    planilha.getRow(numeroLinha).eachCell({ includeEmpty: false }, (cell) => valores.push(normalizar(valorCelula(cell.value))));
    if (marcadores.every((marcador) => valores.some((valor) => valor.includes(marcador)))) return numeroLinha;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Leitura da aba "GERENCIAMENTO DE RISCOS" (42 colunas em ordem fixa)
// ---------------------------------------------------------------------------

const RISCO_COLUNAS = [
  "eixo", "objetivo", "itemCodigo", "itemTitulo", "acaoCodigo", "acaoTitulo", "etapa",
  "riscoEstrategico", "idRisco", "titulo", "causa", "consequencia", "categoria",
  "probabilidade", "impacto", "_riscoInerente", "_nivelRi",
  "controles", "tipoControle", "maturidade", "_fatorControle", "_riscoResidual", "_nivelRr",
  "resposta", "tratamento", "treatmentOwner", "_prazoInicio", "prazo", "_custo",
  "execucao", "_etapaConcluida", "_dataInicioReal", "_dataConclusaoReal", "situacao",
  "_justificativaObs", "status", "review", "_dataProximaRevisao",
  "_mudancaProcesso", "_novosRiscos", "_acoesCorretivas", "_licoesAprendidas",
] as const;

interface RiscoImportado {
  itemCodigo: string;
  acaoCodigo: string;
  etapa: string;
  riscoEstrategico: string;
  titulo: string;
  causa: string;
  consequencia: string;
  categoria: string;
  probabilidade: number;
  impacto: number;
  controles: string;
  tipoControle: string;
  maturidade: string;
  resposta: string;
  tratamento: string;
  treatmentOwner: string;
  prazo: string;
  execucao: number;
  situacao: string;
  review: string;
  status: string;
}

export function lerAbaRiscos(planilha: ExcelJS.Worksheet): RiscoImportado[] {
  const linhaCabecalho = encontrarLinhaCabecalho(planilha, ["eixo", "objetivo do pdi"]);
  if (!linhaCabecalho) return []; // aba de riscos é opcional
  const riscos: RiscoImportado[] = [];
  const contexto = { itemCodigo: "", acaoCodigo: "", etapa: "" };

  for (let numeroLinha = linhaCabecalho + 1; numeroLinha <= planilha.rowCount; numeroLinha++) {
    const row = planilha.getRow(numeroLinha);
    if (row.actualCellCount === 0) continue;
    const linha: Partial<Record<string, string>> = {};
    RISCO_COLUNAS.forEach((chave, indice) => { linha[chave] = valorCelula(row.getCell(indice + 1).value); });
    const valores = (chave: string): string => linha[chave] ?? "";

    if (valores("itemCodigo")) contexto.itemCodigo = extrairCodigo(valores("itemCodigo"));
    if (valores("acaoCodigo")) contexto.acaoCodigo = extrairCodigo(valores("acaoCodigo"));
    if (valores("etapa")) contexto.etapa = valores("etapa");

    const temRisco = valores("titulo") || valores("idRisco") || valores("causa");
    if (!temRisco || !contexto.itemCodigo || !contexto.acaoCodigo) continue;

    const probabilidade = Math.round(Number(valores("probabilidade").replace(",", ".")) || 0);
    const impacto = Math.round(Number(valores("impacto").replace(",", ".")) || 0);
    if (probabilidade < 1 || probabilidade > 5 || impacto < 1 || impacto > 5) continue; // linha sem avaliação válida

    riscos.push({
      itemCodigo: contexto.itemCodigo,
      acaoCodigo: contexto.acaoCodigo,
      etapa: contexto.etapa,
      riscoEstrategico: valores("riscoEstrategico"),
      titulo: valores("titulo") || valores("idRisco") || "Risco sem título",
      causa: valores("causa"),
      consequencia: valores("consequencia"),
      categoria: valores("categoria"),
      probabilidade,
      impacto,
      controles: valores("controles"),
      tipoControle: valores("tipoControle"),
      maturidade: valores("maturidade"),
      resposta: valores("resposta"),
      tratamento: valores("tratamento"),
      treatmentOwner: valores("treatmentOwner"),
      prazo: converterDataBr(valores("prazo")),
      execucao: Number(valores("execucao").replace(",", ".").replace("%", "")) || 0,
      situacao: valores("situacao"),
      review: valores("review"),
      status: valores("status"),
    });
  }
  return riscos;
}

function converterDataBr(texto: string): string {
  if (!texto) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${(m[2] ?? "").padStart(2, "0")}-${(m[1] ?? "").padStart(2, "0")}`;
  return "";
}
