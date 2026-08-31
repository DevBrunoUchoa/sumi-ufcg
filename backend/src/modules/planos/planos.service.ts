import { HttpError } from "../../lib/http-error.js";
import { noPlanoRepository, tipoPlanoRepository } from "./planos.repository.js";
import type { CampoDef, EsquemaCampos, NivelDef, NoPlano, NoPlanoArvore, TipoPlano } from "./planos.types.js";

/** Chave reservada em esquemaCampos para os campos do próprio plano (nó raiz, nivel -1). */
export const NIVEL_RAIZ_CHAVE = "raiz";
export const NIVEL_RAIZ = -1;

/**
 * Permite injetar repositórios fake nos testes unitários sem tocar o
 * Supabase real. Em produção, planosService (default export) já vem ligado
 * aos repositórios reais de planos.repository.ts.
 */
export interface PlanosDeps {
  tipoPlanoRepository: typeof tipoPlanoRepository;
  noPlanoRepository: typeof noPlanoRepository;
}

export function obterCamposDoNivel(tipoPlano: TipoPlano, nivel: number): CampoDef[] {
  if (nivel === NIVEL_RAIZ) {
    return tipoPlano.esquemaCampos[NIVEL_RAIZ_CHAVE] ?? [];
  }
  const nivelDef = tipoPlano.esquemaNiveis.find((n: NivelDef) => n.ordem === nivel);
  if (!nivelDef) {
    throw new HttpError(400, `Tipo de plano "${tipoPlano.nome}" não define o nível ${nivel}`);
  }
  return tipoPlano.esquemaCampos[nivelDef.chave] ?? [];
}

/** Valida `dados` de um nó contra os campos definidos para o seu nível. Lança 400 em caso de erro. */
export function validarDados(campos: CampoDef[], dados: Record<string, unknown>): void {
  const definidos = new Set(campos.map((c) => c.chave));
  const erros: string[] = [];

  for (const chave of Object.keys(dados)) {
    if (!definidos.has(chave)) {
      erros.push(`campo "${chave}" não é definido para este nível`);
    }
  }

  for (const campo of campos) {
    const valor = dados[campo.chave];
    const presente = valor !== undefined && valor !== null && valor !== "";

    if (!presente) {
      if (campo.obrigatorio) erros.push(`campo "${campo.chave}" é obrigatório`);
      continue;
    }

    switch (campo.tipo) {
      case "texto":
      case "texto_longo":
        if (typeof valor !== "string") erros.push(`campo "${campo.chave}" deve ser texto`);
        break;
      case "numero":
      case "percentual":
        if (typeof valor !== "number" || Number.isNaN(valor)) {
          erros.push(`campo "${campo.chave}" deve ser numérico`);
        } else if (campo.tipo === "percentual" && (valor < 0 || valor > 100)) {
          erros.push(`campo "${campo.chave}" deve estar entre 0 e 100`);
        }
        break;
      case "booleano":
        if (typeof valor !== "boolean") erros.push(`campo "${campo.chave}" deve ser booleano`);
        break;
      case "data":
        if (typeof valor !== "string" || Number.isNaN(Date.parse(valor))) {
          erros.push(`campo "${campo.chave}" deve ser uma data válida (ISO 8601)`);
        }
        break;
      case "selecao":
        if (typeof valor !== "string" || !(campo.opcoes ?? []).includes(valor)) {
          erros.push(`campo "${campo.chave}" deve ser uma das opções: ${(campo.opcoes ?? []).join(", ")}`);
        }
        break;
    }
  }

  if (erros.length > 0) {
    throw new HttpError(400, "Dados do nó não conferem com o esquema do tipo de plano", { erros });
  }
}

export function criarPlanosService(deps: PlanosDeps) {
  const { tipoPlanoRepository: tipoPlanoRepo, noPlanoRepository: noPlanoRepo } = deps;

  async function exigirTipoPlano(id: string): Promise<TipoPlano> {
    const tipoPlano = await tipoPlanoRepo.buscarPorId(id);
    if (!tipoPlano) throw new HttpError(404, "Tipo de plano não encontrado");
    return tipoPlano;
  }

  async function exigirNoPlano(id: string): Promise<NoPlano> {
    const no = await noPlanoRepo.buscarPorId(id);
    if (!no) throw new HttpError(404, "Nó do plano não encontrado");
    return no;
  }

  return {
    async listarTiposPlano(opts: { apenasAtivos?: boolean } = {}): Promise<TipoPlano[]> {
      return tipoPlanoRepo.listar(opts);
    },

    async buscarTipoPlano(id: string): Promise<TipoPlano> {
      return exigirTipoPlano(id);
    },

    async criarTipoPlano(input: {
      nome: string;
      descricao?: string;
      esquemaNiveis: NivelDef[];
      esquemaCampos: EsquemaCampos;
    }): Promise<TipoPlano> {
      return tipoPlanoRepo.criar(input);
    },

    async atualizarTipoPlano(
      id: string,
      input: { nome?: string; descricao?: string | null; ativo?: boolean },
    ): Promise<TipoPlano> {
      await exigirTipoPlano(id);
      const atualizado = await tipoPlanoRepo.atualizar(id, input);
      if (!atualizado) throw new HttpError(404, "Tipo de plano não encontrado");
      return atualizado;
    },

    async criarNoPlano(input: {
      tipoPlanoId: string;
      noPaiId: string | null;
      dados: Record<string, unknown>;
    }): Promise<NoPlano> {
      const tipoPlano = await exigirTipoPlano(input.tipoPlanoId);

      let nivel: number;
      if (input.noPaiId === null) {
        nivel = NIVEL_RAIZ;
      } else {
        const pai = await exigirNoPlano(input.noPaiId);
        if (pai.tipoPlanoId !== input.tipoPlanoId) {
          throw new HttpError(409, "O nó pai pertence a um tipo de plano diferente");
        }
        nivel = pai.nivel + 1;
        if (nivel >= tipoPlano.esquemaNiveis.length) {
          throw new HttpError(
            400,
            `Profundidade máxima excedida: "${tipoPlano.nome}" define apenas ${tipoPlano.esquemaNiveis.length} nível(is)`,
          );
        }
      }

      const campos = obterCamposDoNivel(tipoPlano, nivel);
      validarDados(campos, input.dados);

      const ordem = await noPlanoRepo.contarFilhos({ noPaiId: input.noPaiId, tipoPlanoId: input.tipoPlanoId });

      return noPlanoRepo.criar({
        tipoPlanoId: input.tipoPlanoId,
        noPaiId: input.noPaiId,
        nivel,
        ordem,
        dados: input.dados,
      });
    },

    async buscarNoPlano(id: string): Promise<NoPlano> {
      return exigirNoPlano(id);
    },

    async listarFilhos(noPaiId: string | null): Promise<NoPlano[]> {
      return noPlanoRepo.listarFilhos(noPaiId);
    },

    async atualizarDadosNoPlano(id: string, dados: Record<string, unknown>): Promise<NoPlano> {
      const no = await exigirNoPlano(id);
      const tipoPlano = await exigirTipoPlano(no.tipoPlanoId);
      const campos = obterCamposDoNivel(tipoPlano, no.nivel);
      validarDados(campos, dados);

      const atualizado = await noPlanoRepo.atualizarDados(id, dados);
      if (!atualizado) throw new HttpError(404, "Nó do plano não encontrado");
      return atualizado;
    },

    /**
     * Reordena um nó entre irmãos, ou o move para outro pai — desde que o
     * novo pai esteja no mesmo nível do pai atual, para não invalidar o
     * `nivel` (e o esquema de campos) do nó e de toda a sua subárvore.
     */
    async moverNoPlano(
      id: string,
      input: { novoPaiId?: string | null; novaOrdem: number },
    ): Promise<NoPlano> {
      const no = await exigirNoPlano(id);

      if (input.novoPaiId === undefined || input.novoPaiId === no.noPaiId) {
        return (await noPlanoRepo.mover(id, { noPaiId: no.noPaiId, ordem: input.novaOrdem })) as NoPlano;
      }

      if (no.noPaiId === null) {
        throw new HttpError(400, "Um nó raiz (instância de plano) não pode ser movido para outro pai");
      }

      if (input.novoPaiId === null) {
        throw new HttpError(400, "Só o nó raiz de um plano pode ter no_pai_id nulo");
      }

      const paiAtual = await exigirNoPlano(no.noPaiId);
      const novoPai = await exigirNoPlano(input.novoPaiId);

      if (novoPai.tipoPlanoId !== no.tipoPlanoId) {
        throw new HttpError(409, "O novo pai pertence a um tipo de plano diferente");
      }
      if (novoPai.nivel !== paiAtual.nivel) {
        throw new HttpError(
          409,
          "O novo pai precisa estar no mesmo nível do pai atual (mover não muda a profundidade do nó)",
        );
      }

      const descendentes = await noPlanoRepo.arvore(id);
      if (descendentes.some((d: NoPlanoArvore) => d.id === input.novoPaiId)) {
        throw new HttpError(409, "Não é possível mover um nó para dentro da sua própria subárvore");
      }

      const movido = await noPlanoRepo.mover(id, { noPaiId: input.novoPaiId, ordem: input.novaOrdem });
      if (!movido) throw new HttpError(404, "Nó do plano não encontrado");
      return movido;
    },

    async removerNoPlano(id: string): Promise<void> {
      const no = await exigirNoPlano(id);
      const totalFilhos = await noPlanoRepo.contarFilhos({ noPaiId: id, tipoPlanoId: no.tipoPlanoId });
      if (totalFilhos > 0) {
        throw new HttpError(409, "Não é possível remover um nó que possui filhos");
      }
      await noPlanoRepo.remover(id);
    },

    async obterArvore(raizId: string): Promise<NoPlanoArvore[]> {
      await exigirNoPlano(raizId);
      return noPlanoRepo.arvore(raizId);
    },
  };
}

export const planosService = criarPlanosService({ tipoPlanoRepository, noPlanoRepository });
