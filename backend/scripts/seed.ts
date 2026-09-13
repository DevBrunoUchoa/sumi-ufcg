/**
 * Semeia o banco com os modelos (PDI/PLS) e um planejamento inicial de cada
 * tipo, com a estrutura real de eixos usada na validação do Sprint 2 (ver
 * docs/adr/0002-persistencia-postgresql-com-supabase.md e o Eixo 8 do PDI).
 *
 * Não popula iniciativas/ações/riscos de exemplo — isso é conteúdo
 * institucional real (planilha da SEPLAN) e deve ser importado deliberadamente
 * pelo time de produto, não fabricado por este script.
 *
 * Uso:
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... \
 *   SEED_GESTOR_EMAIL=... SEED_GESTOR_PASSWORD=... \
 *   SEED_RESPONSAVEL_EMAIL=... SEED_RESPONSAVEL_PASSWORD=... \
 *   pnpm --filter backend seed
 *
 * Só as credenciais de administrador são obrigatórias; gestor/responsável
 * são opcionais (pulados se as variáveis não forem definidas).
 */
import { randomUUID } from "node:crypto";
import { supabase } from "../src/lib/supabase.js";
import { gerarHashSenha } from "../src/lib/password.js";

interface UsuarioSeed {
  nome: string;
  email: string;
  senha: string;
  papelAdmin: boolean;
}

function usuarioOpcional(prefixo: string, papelAdmin: boolean, nomePadrao: string): UsuarioSeed | null {
  const email = process.env[`SEED_${prefixo}_EMAIL`];
  const senha = process.env[`SEED_${prefixo}_PASSWORD`];
  if (!email || !senha) return null;
  return { nome: process.env[`SEED_${prefixo}_NOME`] || nomePadrao, email, senha, papelAdmin };
}

async function upsertUsuario(usuario: UsuarioSeed): Promise<string> {
  const { data: existente, error: erroBusca } = await supabase
    .from("usuario")
    .select("id")
    .eq("email", usuario.email.trim().toLowerCase())
    .maybeSingle();
  if (erroBusca) throw erroBusca;
  if (existente) return (existente as { id: string }).id;

  const { data, error } = await supabase
    .from("usuario")
    .insert({
      nome: usuario.nome,
      email: usuario.email.trim().toLowerCase(),
      senha_hash: gerarHashSenha(usuario.senha),
      papel_admin: usuario.papelAdmin,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function upsertTipoPlano(input: {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  versao: number;
  rotulos: { axis: string; objective: string; item: string };
  periodicidadePadrao: "annual" | "final";
}): Promise<string> {
  const { data: existente, error: erroBusca } = await supabase.from("tipo_plano").select("id").eq("id", input.id).maybeSingle();
  if (erroBusca) throw erroBusca;
  if (existente) return (existente as { id: string }).id;

  const { data, error } = await supabase
    .from("tipo_plano")
    .insert({
      id: input.id,
      nome: input.nome,
      descricao: input.descricao,
      esquema_niveis: [
        { ordem: 0, chave: "eixo", rotulo: input.rotulos.axis },
        { ordem: 1, chave: "objetivo", rotulo: input.rotulos.objective },
        { ordem: 2, chave: "item", rotulo: input.rotulos.item },
      ],
      esquema_campos: {},
      tipo: input.tipo,
      versao: input.versao,
      rotulos: input.rotulos,
      periodicidade_padrao: input.periodicidadePadrao,
      campos_extras: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function upsertNoPlano(input: {
  id: string;
  tipoPlanoId: string;
  noPaiId: string | null;
  nivel: number;
  ordem: number;
  dados: Record<string, unknown>;
}): Promise<string> {
  const { data: existente, error: erroBusca } = await supabase.from("no_plano").select("id").eq("id", input.id).maybeSingle();
  if (erroBusca) throw erroBusca;
  if (existente) return (existente as { id: string }).id;

  const { data, error } = await supabase
    .from("no_plano")
    .insert({ id: input.id, tipo_plano_id: input.tipoPlanoId, no_pai_id: input.noPaiId, nivel: input.nivel, ordem: input.ordem, dados: input.dados })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function main() {
  const admin = usuarioOpcional("ADMIN", true, "Administrador SEPLAN");
  if (!admin) {
    throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD para semear o usuário administrador.");
  }
  await upsertUsuario(admin);
  console.log(`Usuário administrador pronto: ${admin.email}`);

  const gestor = usuarioOpcional("GESTOR", false, "Gestor do Eixo (semente)");
  const gestorId = gestor ? await upsertUsuario(gestor) : null;
  if (gestor) console.log(`Usuário gestor pronto: ${gestor.email}`);

  const responsavel = usuarioOpcional("RESPONSAVEL", false, "Responsável pelo Eixo (semente)");
  const responsavelId = responsavel ? await upsertUsuario(responsavel) : null;
  if (responsavel) console.log(`Usuário responsável pronto: ${responsavel.email}`);

  const pdiTipoId = await upsertTipoPlano({
    id: randomUUID(),
    nome: "Desenvolvimento institucional",
    descricao: "Objetivos, iniciativas, indicadores, metas anuais, ações e etapas.",
    tipo: "PDI",
    versao: 1,
    rotulos: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" },
    periodicidadePadrao: "annual",
  });
  const plsTipoId = await upsertTipoPlano({
    id: randomUUID(),
    nome: "Logística sustentável",
    descricao: "Objetivos, metas, indicadores, ações e entregas de sustentabilidade.",
    tipo: "PLS",
    versao: 1,
    rotulos: { axis: "Eixo", objective: "Objetivo", item: "Meta" },
    periodicidadePadrao: "final",
  });
  console.log("Modelos PDI/PLS prontos.");

  const pdiId = await upsertNoPlano({
    id: randomUUID(),
    tipoPlanoId: pdiTipoId,
    noPaiId: null,
    nivel: -1,
    ordem: 0,
    dados: { shortName: "PDI", name: "Plano de Desenvolvimento Institucional", start: 2026, end: 2030, status: "published" },
  });
  const pdiEixo8Id = await upsertNoPlano({
    id: randomUUID(),
    tipoPlanoId: pdiTipoId,
    noPaiId: pdiId,
    nivel: 0,
    ordem: 0,
    dados: {
      code: "8",
      name: "Governança e Gestão Institucional",
      color: "#2f78a5",
      ownerUnit: "SEPLAN",
      managerIds: gestorId ? [gestorId] : [],
      reviewerIds: responsavelId ? [responsavelId] : [],
    },
  });
  await upsertNoPlano({
    id: randomUUID(),
    tipoPlanoId: pdiTipoId,
    noPaiId: pdiEixo8Id,
    nivel: 1,
    ordem: 0,
    dados: { code: "8.1", title: "Aperfeiçoar Práticas de Governança Pública" },
  });
  await upsertNoPlano({
    id: randomUUID(),
    tipoPlanoId: pdiTipoId,
    noPaiId: pdiEixo8Id,
    nivel: 1,
    ordem: 1,
    dados: { code: "8.2", title: "Aperfeiçoar Práticas de Gestão Institucional" },
  });
  console.log("PDI 2026-2030 (Eixo 8) pronto.");

  const plsId = await upsertNoPlano({
    id: randomUUID(),
    tipoPlanoId: plsTipoId,
    noPaiId: null,
    nivel: -1,
    ordem: 0,
    dados: { shortName: "PLS", name: "Plano Diretor de Logística Sustentável", start: 2025, end: 2030, status: "published" },
  });
  const plsEixos: [string, string, string, string][] = [
    ["1", "Promoção da racionalização e do consumo consciente de bens e serviços", "#4c8c68", "SEPLAN"],
    ["3", "Identificação dos objetos de menor impacto ambiental", "#7656a8", "PRGAF"],
    ["7", "Qualidade de vida", "#d29b18", "SRH"],
  ];
  for (const [index, [code, name, color, ownerUnit]] of plsEixos.entries()) {
    await upsertNoPlano({
      id: randomUUID(),
      tipoPlanoId: plsTipoId,
      noPaiId: plsId,
      nivel: 0,
      ordem: index,
      dados: { code, name, color, ownerUnit, managerIds: [], reviewerIds: responsavelId ? [responsavelId] : [] },
    });
  }
  console.log("PLS 2025-2030 pronto.");

  console.log("Seed concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
