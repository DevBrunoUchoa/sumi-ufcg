# ADR 0010 — ODS na identificação dos objetivos

Status: integrado ao cadastro persistido de ODS, em 12/10/2026.

A comparação visual avaliou ícones ao lado do título, abaixo da identificação
e em um cartão próprio. A linha abaixo da unidade responsável preserva a
largura do título e aproxima as ODS do objetivo, sem acrescentar uma superfície
entre a identificação e os gráficos. Os ícones têm 64 px e aparecem apenas na
página própria do objetivo. Após validação, a versão compacta foi removida da
tela intermediária do eixo a pedido do usuário. Não são repetidos nos grupos
de objetivos, nos gráficos, nas iniciativas nem nos cartões de entrada dos eixos.

Os objetivos com vínculo a todas as 17 ODS usam uma divulgação progressiva:
“Todas as 17 ODS” abre a lista completa, inicialmente recolhida. Não há seleção
arbitrária de três ícones para representar o conjunto. A divulgação é nativa
do HTML, operável por teclado, e as imagens se distribuem em várias linhas em
telas pequenas. Cada ícone oferece nome acessível e link para a respectiva
página da ONU Brasil, indicando a abertura em nova aba. Cores, proporções e
arte oficial são preservadas no tema escuro e no alto contraste.

## Vínculos documentados e integração

`frontend/src/planning/pdi-ods-reference.json` registra os 27 objetivos da
seção 3.1 do PDI UFCG 2026–2030, aprovado pela Resolução nº 09/2025 do Colegiado
Pleno, incluindo código, título, ODS e página do PDF. O arquivo fonte consultado
foi `Elaboração do PDI (2026-2030) - RES_09.2025-COLPLENO.pdf`, disponível nos
documentos locais. Os arquivos privados não são necessários em execução.

A fonte são as linhas escritas “ODS vinculado(s)” de cada objetivo. Os ícones
repetidos no cabeçalho do PDF não são usados para inferir vínculos. Em especial,
Pesquisa e Inovação declara “Todos” nos objetivos 2.1, 2.2 e 2.3.

O resolvedor é limitado ao PDI 2026–2030 e exige correspondência do título e do
eixo com a referência. Diferenças de maiúsculas, acentos, espaços e pontuação
são normalizadas. Assim, também funciona com o código malformado de 6.1 no
importador existente, sem corrigir ou reimportar dados. Códigos iguais com
títulos diferentes não recebem vínculos do documento; outros planos e
vigências também não. Objetivos sem correspondência não exibem o componente.
O objetivo 6.4 também aceita a variação exata do título encontrada na API
durante a validação Docker (“se constitua como princípio transversal”),
registrada explicitamente como alias da referência, sem correspondência difusa.

O cadastro editável do main foi incorporado: `Objective.ods` guarda a seleção
explícita no JSONB do objetivo. A lista cadastrada tem prioridade sobre a
referência documental, inclusive quando vazia. Objetivos legados sem o campo
continuam usando os vínculos documentados; novos objetivos podem receber ODS
arbitrárias pelo formulário Estrutura, com a permissão `plan.manage`.

O formulário mostra a seleção efetiva e oferece aplicar os vínculos do PDI
quando existe correspondência documental. Essa aplicação só é persistida ao
salvar a estrutura. Navegação e consulta não fazem gravações automáticas.

O backend mantém o campo opcional para clientes antigos: omissão preserva o
cadastro existente; uma lista vazia representa remoção explícita. A validação
aceita apenas inteiros de 1 a 17 e normaliza repetições e ordenação. Objetivos
novos importados não recebem lista vazia artificialmente. A ausência do campo
em registros antigos não é tratada como mudança de estrutura.

Os SVGs oficiais e a procedência dos ativos estão em
`frontend/public/images/ods/README.md`. O estudo visual e as capturas de
validação ficam em `.analysis-pdi/`, fora do versionamento.
