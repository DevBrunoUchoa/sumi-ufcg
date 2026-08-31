import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import { criarPlanosService, validarDados } from "./planos.service.js";
import type { CampoDef, NoPlano, NoPlanoArvore, TipoPlano } from "./planos.types.js";

/**
 * Repositórios em memória, com a mesma forma dos repositórios reais
 * (planos.repository.ts), para testar o motor de planos (planos.service.ts)
 * sem depender do Supabase.
 */
function criarRepositoriosFake() {
  const tipos = new Map<string, TipoPlano>();
  const nos = new Map<string, NoPlano>();
  let sequencia = 0;
  const proximoId = () => `id-${++sequencia}`;

  const tipoPlanoRepository = {
    async listar(opts: { apenasAtivos?: boolean } = {}) {
      const todos = [...tipos.values()];
      return opts.apenasAtivos ? todos.filter((t) => t.ativo) : todos;
    },
    async buscarPorId(id: string) {
      return tipos.get(id) ?? null;
    },
    async criar(input: {
      nome: string;
      descricao?: string;
      esquemaNiveis: TipoPlano["esquemaNiveis"];
      esquemaCampos: TipoPlano["esquemaCampos"];
    }) {
      const tipo: TipoPlano = {
        id: proximoId(),
        ativo: true,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        nome: input.nome,
        descricao: input.descricao ?? null,
        esquemaNiveis: input.esquemaNiveis,
        esquemaCampos: input.esquemaCampos,
      };
      tipos.set(tipo.id, tipo);
      return tipo;
    },
    async atualizar(id: string, input: Partial<Pick<TipoPlano, "nome" | "descricao" | "ativo">>) {
      const atual = tipos.get(id);
      if (!atual) return null;
      const atualizado = { ...atual, ...input };
      tipos.set(id, atualizado);
      return atualizado;
    },
  };

  const noPlanoRepository = {
    async buscarPorId(id: string) {
      return nos.get(id) ?? null;
    },
    async listarFilhos(noPaiId: string | null) {
      return [...nos.values()]
        .filter((n) => n.noPaiId === noPaiId)
        .sort((a, b) => a.ordem - b.ordem);
    },
    async contarFilhos(input: { noPaiId: string | null; tipoPlanoId: string }) {
      return [...nos.values()].filter(
        (n) => n.noPaiId === input.noPaiId && n.tipoPlanoId === input.tipoPlanoId,
      ).length;
    },
    async criar(input: Omit<NoPlano, "id" | "criadoEm" | "atualizadoEm">) {
      const no: NoPlano = {
        id: proximoId(),
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        ...input,
      };
      nos.set(no.id, no);
      return no;
    },
    async atualizarDados(id: string, dados: Record<string, unknown>) {
      const atual = nos.get(id);
      if (!atual) return null;
      const atualizado = { ...atual, dados };
      nos.set(id, atualizado);
      return atualizado;
    },
    async mover(id: string, input: { noPaiId: string | null; ordem: number }) {
      const atual = nos.get(id);
      if (!atual) return null;
      const atualizado = { ...atual, noPaiId: input.noPaiId, ordem: input.ordem };
      nos.set(id, atualizado);
      return atualizado;
    },
    async remover(id: string) {
      nos.delete(id);
    },
    async arvore(raizId: string): Promise<NoPlanoArvore[]> {
      const raiz = nos.get(raizId);
      if (!raiz) return [];
      const resultado: NoPlanoArvore[] = [];
      const visitar = (no: NoPlano, profundidade: number) => {
        resultado.push({ ...no, profundidade });
        for (const filho of [...nos.values()]
          .filter((n) => n.noPaiId === no.id)
          .sort((a, b) => a.ordem - b.ordem)) {
          visitar(filho, profundidade + 1);
        }
      };
      visitar(raiz, 0);
      return resultado;
    },
  };

  return { tipoPlanoRepository, noPlanoRepository, tipos, nos };
}

const campoTitulo: CampoDef = { chave: "titulo", rotulo: "Título", tipo: "texto", obrigatorio: true };
const campoPercentual: CampoDef = { chave: "execucao", rotulo: "Execução", tipo: "percentual" };
const campoSelecao: CampoDef = {
  chave: "status",
  rotulo: "Status",
  tipo: "selecao",
  opcoes: ["aberto", "concluido"],
};

describe("validarDados", () => {
  it("acusa campo obrigatório ausente", () => {
    expect(() => validarDados([campoTitulo], {})).toThrow(HttpError);
  });

  it("acusa campo não definido no esquema", () => {
    expect(() => validarDados([campoTitulo], { titulo: "x", extra: 1 })).toThrow(HttpError);
  });

  it("acusa tipo errado (numero/percentual)", () => {
    expect(() => validarDados([campoPercentual], { execucao: "50" })).toThrow(HttpError);
    expect(() => validarDados([campoPercentual], { execucao: 150 })).toThrow(HttpError);
    expect(() => validarDados([campoPercentual], { execucao: 50 })).not.toThrow();
  });

  it("acusa valor fora das opções de seleção", () => {
    expect(() => validarDados([campoSelecao], { status: "outro" })).toThrow(HttpError);
    expect(() => validarDados([campoSelecao], { status: "aberto" })).not.toThrow();
  });

  it("aceita quando todos os campos batem com o esquema", () => {
    expect(() => validarDados([campoTitulo, campoPercentual], { titulo: "PDI", execucao: 42 })).not.toThrow();
  });
});

describe("planosService (motor de planos)", () => {
  let repos: ReturnType<typeof criarRepositoriosFake>;
  let service: ReturnType<typeof criarPlanosService>;

  beforeEach(() => {
    repos = criarRepositoriosFake();
    service = criarPlanosService(repos);
  });

  async function criarTipoPdiEixo8() {
    return service.criarTipoPlano({
      nome: "PDI",
      esquemaNiveis: [
        { ordem: 0, chave: "eixo", rotulo: "Eixo" },
        { ordem: 1, chave: "objetivo", rotulo: "Objetivo" },
        { ordem: 2, chave: "iniciativa", rotulo: "Iniciativa" },
      ],
      esquemaCampos: {
        raiz: [campoTitulo],
        eixo: [campoTitulo],
        objetivo: [campoTitulo],
        iniciativa: [campoTitulo, campoPercentual],
      },
    });
  }

  it("cria a raiz (instância do plano) com nivel -1", async () => {
    const tipo = await criarTipoPdiEixo8();
    const raiz = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: null, dados: { titulo: "PDI 2026-2030" } });
    expect(raiz.nivel).toBe(-1);
    expect(raiz.noPaiId).toBeNull();
  });

  it("encadeia níveis a partir da raiz, herdando o esquema de cada nível", async () => {
    const tipo = await criarTipoPdiEixo8();
    const raiz = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: null, dados: { titulo: "PDI 2026-2030" } });
    const eixo = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: raiz.id, dados: { titulo: "Eixo 8" } });
    expect(eixo.nivel).toBe(0);

    const objetivo = await service.criarNoPlano({
      tipoPlanoId: tipo.id,
      noPaiId: eixo.id,
      dados: { titulo: "Aperfeiçoar governança" },
    });
    expect(objetivo.nivel).toBe(1);

    await expect(
      service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: objetivo.id, dados: { titulo: "x", execucao: "não é número" } }),
    ).rejects.toThrow(HttpError);

    const iniciativa = await service.criarNoPlano({
      tipoPlanoId: tipo.id,
      noPaiId: objetivo.id,
      dados: { titulo: "Elaborar o Plano de Gestão de Riscos", execucao: 16.84 },
    });
    expect(iniciativa.nivel).toBe(2);
  });

  it("rejeita nó além da profundidade máxima definida em esquemaNiveis", async () => {
    const tipo = await criarTipoPdiEixo8();
    const raiz = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: null, dados: { titulo: "PDI" } });
    const eixo = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: raiz.id, dados: { titulo: "Eixo 8" } });
    const objetivo = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: eixo.id, dados: { titulo: "Obj" } });
    const iniciativa = await service.criarNoPlano({
      tipoPlanoId: tipo.id,
      noPaiId: objetivo.id,
      dados: { titulo: "Iniciativa" },
    });

    await expect(
      service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: iniciativa.id, dados: { titulo: "Além do limite" } }),
    ).rejects.toThrow(/Profundidade máxima/);
  });

  it("reordena entre irmãos e bloqueia mover para pai de outro nível", async () => {
    const tipo = await criarTipoPdiEixo8();
    const raiz = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: null, dados: { titulo: "PDI" } });
    const eixoA = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: raiz.id, dados: { titulo: "Eixo A" } });
    const eixoB = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: raiz.id, dados: { titulo: "Eixo B" } });
    const objetivo = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: eixoA.id, dados: { titulo: "Obj" } });

    const movido = await service.moverNoPlano(eixoB.id, { novaOrdem: 0 });
    expect(movido.ordem).toBe(0);

    await expect(service.moverNoPlano(objetivo.id, { novoPaiId: raiz.id, novaOrdem: 0 })).rejects.toThrow(
      /mesmo nível/,
    );
  });

  it("bloqueia remover nó com filhos, mas permite remover nó-folha", async () => {
    const tipo = await criarTipoPdiEixo8();
    const raiz = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: null, dados: { titulo: "PDI" } });
    const eixo = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: raiz.id, dados: { titulo: "Eixo 8" } });

    await expect(service.removerNoPlano(raiz.id)).rejects.toThrow(/possui filhos/);
    await expect(service.removerNoPlano(eixo.id)).resolves.toBeUndefined();
    await expect(service.buscarNoPlano(eixo.id)).rejects.toThrow(HttpError);
  });

  it("monta a árvore completa a partir da raiz, em profundidade", async () => {
    const tipo = await criarTipoPdiEixo8();
    const raiz = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: null, dados: { titulo: "PDI" } });
    const eixo = await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: raiz.id, dados: { titulo: "Eixo 8" } });
    await service.criarNoPlano({ tipoPlanoId: tipo.id, noPaiId: eixo.id, dados: { titulo: "Objetivo 1" } });

    const arvore = await service.obterArvore(raiz.id);
    expect(arvore.map((n) => n.profundidade)).toEqual([0, 1, 2]);
  });
});
