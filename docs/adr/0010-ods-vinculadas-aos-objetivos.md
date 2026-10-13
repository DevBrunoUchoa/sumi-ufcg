# ADR 0010 — ODS na identificação dos objetivos

Status: implementado localmente para validação, em 12/10/2026.

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

Essa referência é leitura documental, não um cadastro editável de ODS. O
componente funciona tanto com a API quanto com a prévia local; não depende de
IDs locais, não exige alteração no backend e não faz gravações na API. Um
cadastro futuro de vínculos arbitrários deve definir um campo persistido e
suas permissões, em vez de usar o código de objetivo como associação implícita.

Os SVGs oficiais e a procedência dos ativos estão em
`frontend/public/images/ods/README.md`. O estudo visual e as capturas de
validação ficam em `.analysis-pdi/`, fora do versionamento.
