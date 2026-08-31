import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";

const chaveSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/, "use snake_case (letras minúsculas, números e _)");

export const campoDefSchema = z
  .object({
    chave: chaveSchema,
    rotulo: z.string().trim().min(1),
    tipo: z.enum(["texto", "texto_longo", "numero", "percentual", "data", "booleano", "selecao"]),
    obrigatorio: z.boolean().optional(),
    opcoes: z.array(z.string().trim().min(1)).min(1).optional(),
  })
  .refine((campo) => campo.tipo !== "selecao" || (campo.opcoes && campo.opcoes.length > 0), {
    message: "campos do tipo 'selecao' precisam de 'opcoes'",
    path: ["opcoes"],
  });

export const nivelDefSchema = z.object({
  ordem: z.number().int().min(0),
  chave: chaveSchema,
  rotulo: z.string().trim().min(1),
  rotuloPlural: z.string().trim().min(1).optional(),
});

const esquemaNiveisSchema = z
  .array(nivelDefSchema)
  .min(1, "um tipo de plano precisa de pelo menos um nível")
  .superRefine((niveis, ctx) => {
    const chaves = new Set<string>();
    const ordens = [...niveis.map((n) => n.ordem)].sort((a, b) => a - b);

    for (const nivel of niveis) {
      if (chaves.has(nivel.chave)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `chave de nível duplicada: "${nivel.chave}"`,
        });
      }
      chaves.add(nivel.chave);
    }

    const esperado = niveis.map((_, i) => i);
    if (JSON.stringify(ordens) !== JSON.stringify(esperado)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "esquemaNiveis.ordem precisa ser sequencial começando em 0, sem repetição",
      });
    }
  });

function esquemaCamposSchema(chavesValidas?: string[]) {
  return z.record(chaveSchema, z.array(campoDefSchema)).superRefine((esquema, ctx) => {
    if (!chavesValidas) return;
    for (const chave of Object.keys(esquema)) {
      if (!chavesValidas.includes(chave)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `esquemaCampos possui a chave "${chave}", que não existe em esquemaNiveis`,
          path: [chave],
        });
      }
    }
  });
}

export const tipoPlanoCreateSchema = z
  .object({
    nome: z.string().trim().min(1),
    descricao: z.string().trim().min(1).optional(),
    esquemaNiveis: esquemaNiveisSchema,
    esquemaCampos: z.record(chaveSchema, z.array(campoDefSchema)).default({}),
  })
  .superRefine((tipo, ctx) => {
    // "raiz" é uma chave reservada: campos do próprio plano (nó com nivel -1),
    // que não faz parte de esquemaNiveis (esse só descreve nivel >= 0).
    const chaves = [...tipo.esquemaNiveis.map((n) => n.chave), "raiz"];
    const resultado = esquemaCamposSchema(chaves).safeParse(tipo.esquemaCampos);
    if (!resultado.success) {
      for (const issue of resultado.error.issues) {
        ctx.addIssue({ ...issue, path: ["esquemaCampos", ...issue.path] });
      }
    }
  });

export const tipoPlanoUpdateSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  descricao: z.string().trim().min(1).nullable().optional(),
  ativo: z.boolean().optional(),
  // esquemaNiveis/esquemaCampos não são editáveis aqui: alterar a estrutura de
  // um tipo_plano já em uso quebraria os nós existentes. Ver planos.service.ts.
});

export const noPlanoCreateSchema = z.object({
  tipoPlanoId: z.string().uuid(),
  noPaiId: z.string().uuid().nullable(),
  dados: z.record(z.string(), z.unknown()).default({}),
});

export const noPlanoUpdateSchema = z.object({
  dados: z.record(z.string(), z.unknown()),
});

export const reordenarNoPlanoSchema = z.object({
  novoPaiId: z.string().uuid().nullable().optional(),
  novaOrdem: z.number().int().min(0),
});

export function parseOrLancar<T>(schema: z.ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) {
    throw new HttpError(400, "Dados inválidos", resultado.error.flatten());
  }
  return resultado.data;
}
