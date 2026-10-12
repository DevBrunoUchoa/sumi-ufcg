# ADR 0007: consulta pública e área de trabalho no padrão GOV.BR

Status: implementado localmente para validação.

## Contexto

O SUMI oferece consulta aberta aos planos publicados e funções de gestão por
perfil e escopo. O mesmo menu lateral, antes aplicado a ambos, expunha a estrutura
administrativa ao visitante e dificultava a leitura institucional. A aplicação
já utiliza Rawline, tokens e componentes do Design System GOV.BR.

## Decisão

Uma estrutura compartilhada (`layout/AppShell.jsx`) organiza cabeçalho, conteúdo
e rodapé. Existem três contextos de apresentação:

- **Consulta pública:** navegação horizontal Início / Planos / Sobre, acesso ao
  login, sem menu lateral nem identidade fictícia de visitante.
- **Área de trabalho:** menu lateral com rótulos, somente os destinos permitidos
  pela sessão, identificação da pessoa e saída. Em dispositivos pequenos, o menu
  ocupa uma camada própria com foco contido e fechamento por Escape.
- **Acesso:** cabeçalho compacto e formulário do SUMI centralizado. A marca no
  cabeçalho retorna à consulta pública. A tela não depende do carregamento do planejamento.

O rodapé está presente nos três contextos e contém marca, links institucionais,
ajuda e informações sobre armazenamento na consulta e no acesso. Na área de
trabalho, é uma barra compacta de ajuda e privacidade, fixa no fim da janela,
com espaço reservado no layout para manter o conteúdo acessível. SUMI é a identidade principal; unidades
como SEPLAN aparecem como responsáveis nos dados dos planos, sem serem tratadas
como proprietárias do produto.

O caminho de navegação é único, calculado com o mesmo resolvedor das URLs do PDI:
Plano → Eixo → Objetivo → Iniciativa → Ação → Riscos da ação/etapa. O título
principal identifica o conteúdo atual. Os links antigos e a navegação do PLS
continuam suportados. A consulta não concede acesso a risco/histórico internos.

## Sessão e integração

O formulário usa o contrato existente `POST /api/v1/auth/login`, com cookies e
os campos `email` e `senha`. Após autenticar, a sessão e o workspace são carregados
novamente. A reidratação estabelece uma nova referência de dados salvos e não
dispara `PUT`. Ao sair, alterações pendentes são salvas antes do encerramento da
sessão; o workspace interno é removido e a consulta pública é recarregada.

Destinos de retorno são restritos às rotas locais conhecidas. Falhas da API
preservam cabeçalho/rodapé, navegação ao acesso e opção de tentar novamente.

`VITE_GOVBR_LOGIN_ENABLED` é falso por padrão. Só pode ser ativado depois de
implementar e configurar a autorização/callback OIDC no servidor e concluir a
integração necessária com o provedor GOV.BR. A rota prevista é
`/api/v1/auth/govbr/authorize`; ela ainda não é implementada pelo backend atual.
Nenhuma credencial do provedor pertence ao frontend. O SUMI não coleta senha
GOV.BR, não simula sua página de autenticação e não oferece um botão inoperante.

## Preferência de aparência

O menu Acessibilidade oferece tema escuro, salvo no navegador em
`sumi.ui.dark-mode`. A preferência é aplicada antes de iniciar a aplicação para
evitar um clarão no recarregamento. Tema escuro e alto contraste são alternativas
exclusivas; ativar uma desativa a outra. As cores semânticas em `layout/theme.css`
alcançam o Core e os Web Components existentes sem alterar a paleta dos eixos.
Textos e navegação usam cinzas neutros; ações primárias mantêm o azul do GOV.BR.
A orientação de temas da versão 4 Alpha foi consultada como referência de cores,
sem migrar as dependências atuais da versão 3.

## Métricas e evolução

As contagens e percentuais atuais usam os dados dos planos e os seletores
existentes. Execução das etapas sempre tem rótulo e denominador de etapas ativas;
é distinta do cumprimento da meta de um indicador. Ausência de dados não é zero.
`planning/selectors.js` e `ScopeSummary` mantêm agregações separadas da navegação,
permitindo acrescentar gráficos por plano/eixo sem mover regras para a interface.
Não foram adicionadas séries ou métricas artificiais.

## Verificação

Testes cobrem consulta pública, permissões por eixo, fluxo de resultados e
validação, riscos vinculados às etapas, links antigos, importação HTTP, login/
logout com troca de dados sem gravação de reidratação, falha e recuperação de
API, teclado e dispositivos pequenos. A verificação visual inclui as telas de
entrada pública, login, eixo e ação. A integração HTTP é verificada com respostas
interceptadas, sem utilizar o banco de produção.

## Referências

- https://www.gov.br/ds/components/header
- https://www.gov.br/ds/components/menu
- https://www.gov.br/ds/components/footer
- https://www.gov.br/ds/components/signin
- Pacotes existentes: `@govbr-ds/core` 3.7 e Web Components 2.2.

Os documentos locais usados para contexto não fazem parte desta decisão nem
devem ser adicionados ao Git. O protótipo externo foi preservado com o servidor
desligado. Esta evolução sucede o snapshot enviado a `gov-ds` e permanece local
até nova autorização de envio.
