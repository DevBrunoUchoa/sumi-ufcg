# ADR 0008 — objetivos e painéis de acompanhamento do PDI

Status: implementado localmente para validação, em 12/10/2026.

O objetivo ganha uma página própria em `/plano/:plano/eixo/:eixo/objetivo/:objetivo`,
com título, resumo, iniciativas e indicadores restritos ao seu escopo. O ano das
metas fica na URL e é preservado ao recarregar. Links anteriores com `?objective`
continuam funcionando; iniciativas, ações e riscos conservam os links existentes.
O breadcrumb e o contexto da iniciativa oferecem retorno à página do objetivo.

Os grupos do eixo permanecem abertos por padrão, com opção individual de
recolhimento e acesso “Acompanhar objetivo”. Eixos, objetivos e iniciativas são
ordenados por código sem alterar a ordem persistida ou seus identificadores.
Códigos de objetivo ausentes ou não numéricos não repetem o título no cabeçalho.

Os painéis apresentam execução por eixo, objetivo e iniciativa; distribuição
atual das etapas; e situação das metas no ano selecionado. A iniciativa numérica
também apresenta meta e resultado por período. As visualizações usam SVG/CSS,
tokens do GOV.BR e superfícies dos componentes existentes, sem nova biblioteca.
Cada gráfico oferece os valores em texto e uma tabela equivalente. O tema
escuro e o alto contraste têm tratamento próprio; formas, rótulos e traços
distinguem séries sem depender apenas de cor.

Execução corresponde à proporção de etapas ativas concluídas, excluindo
canceladas. A distribuição de situações inclui canceladas e explicita esse
denominador diferente. Ausência de etapas é “Sem etapas ativas”. Percentuais
do resumo usam uma casa decimal para não esconder avanços inferiores a 1%.

Cada indicador é comparado à sua própria meta, respeitando direção de aumento
ou redução e igualdade para entregas descritivas. Não existe média de valores
com unidades diferentes nem um percentual geral de alcance do objetivo. Meta
textual sem comparação numérica segura aparece como “Sem meta comparável”,
preservando seu texto na tabela. Resultados ausentes não são convertidos em
zero. Metas de ciclo são separadas nos anos anteriores ao fim do plano.

A série numérica não conecta períodos sem dados, não fabrica histórico da
execução e apresenta metas futuras sem inventar resultados. Indicadores por
etapas seguem a regra existente: execução atual para o período corrente e
fechamentos registrados para anos anteriores.

O contrato do workspace e as permissões permanecem iguais. As agregações usam
os dados retornados pela API. Não são adicionadas contas, migrações locais ou
dados de exemplo para implementar os painéis. O PLS conserva o explorador
atual. A prévia já existente continua disponível apenas para validação local.

Os scripts iniciais de tema e VLibras foram movidos para arquivos da própria
aplicação, compatíveis com a CSP do backend, sem liberar scripts inline.

A faixa de contagens gerais foi removida das páginas do plano, eixo e objetivo.
O percentual de execução e o denominador de etapas ficam no próprio gráfico;
a quantidade de iniciativas acompanha a listagem, e a quantidade de ações
permanece junto de cada iniciativa. A metodologia de execução pode ser
expandida no gráfico. Essa composição substitui a apresentação de `ScopeSummary`.

Referências: [Dashboard GOV.BR](https://www.gov.br/ds/downloads/assets?tab=uikits),
[conteúdo acessível e gráficos](https://www.gov.br/gestaodeconteudo/pt-br/manuais-e-tutoriais/diretrizes-para-edicao-de-conteudo/cartilha-de-acessibilidade-gov.br),
e a navegação por recortes do painel público ForPDI da UFF.
