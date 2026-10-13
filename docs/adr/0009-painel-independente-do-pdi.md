# ADR 0009 — painel independente do PDI

Status: implementado e revisado localmente para integração ao main, em 12/10/2026.

O PDI volta a apresentar os cartões de eixo na entrada. O painel de acompanhamento
tem uma página própria em `/plano/:id/painel`, acessível no cabeçalho do plano,
eixo e objetivo. Os painéis compactos dos eixos e objetivos continuam disponíveis.
O PLS mantém o fluxo anterior.

O painel oferece filtros de eixo, objetivo e ano das metas, persistidos na URL.
Links do gráfico aprofundam o painel, mantendo o ano. A opção Explorar retorna
à página de consulta do escopo atual, conservando o ano das metas. A troca de
filtros no painel preserva foco e posição; o foco só muda ao abrir explicitamente
um ponto de atenção. Filtros com identificadores inexistentes,
objetivo de outro eixo ou ano fora da vigência são rejeitados.

As seções apresentam execução atual, distribuição das metas no período,
cobertura dos resultados e prazos das etapas. A lista de pontos de atenção
permite acessar as iniciativas e distinguir falta de resultado, meta não
atingida, ausência de meta comparável e prazo vencido. Metas não atingidas
respeitam indicadores de aumento e de redução e não são apresentadas como
atraso de cronograma nem como previsão de
descumprimento. Não são produzidas médias de indicadores com unidades diferentes.

Cobertura conta indicadores com resultado informado ou calculado no período.
Resultados zero são válidos; um indicador automático sem etapas ativas permanece
sem resultado. Indicadores de ciclo ficam fora da cobertura anual até o último
ano. Prazos ausentes são informados separadamente e não significam ausência de
atraso. A execução e os prazos são a situação atual, sem filtro histórico pelo
ano das metas.

Categorias de validação e correção respeitam as permissões globais de acesso às
filas e as permissões por iniciativa/eixo. A consulta pública não recebe os
estados dessas filas na lista nem nos filtros. URLs que pedem uma categoria
interna sem permissão mostram a tela de acesso negado ou de autenticação.

A implementação consome o workspace existente, sem endpoints, dados artificiais
ou persistência adicionais. Navegação e filtros não gravam no workspace. O
layout utiliza as superfícies e os componentes GOV.BR já adotados, as preferências
de tema e as tabelas equivalentes dos gráficos. A lista apresenta dez iniciativas
por vez e permite carregar mais sem encerrar o contexto.

O adaptador de workspace local foi isolado em `frontend/dev/planning-client.js`,
carregado apenas em desenvolvimento. A compilação de produção utiliza a API
HTTP e elimina os exemplos e a migração de prévia do bundle. As pastas privadas
de documentos, prévia e análise ficam fora do contexto de build Docker.

Esta etapa permanece local, sem publicação ou alteração de dados no Supabase remoto.
