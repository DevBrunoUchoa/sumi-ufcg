# Ícones dos Objetivos de Desenvolvimento Sustentável

Os 17 SVGs oficiais em português foram obtidos diretamente da página de
[Objetivos de Desenvolvimento Sustentável da ONU Brasil](https://brasil.un.org/pt-br/sdgs)
em 12 de outubro de 2026. Os arquivos foram preservados sem conversão ou edição:
contêm número, nome do objetivo, símbolo e cor originais, com `viewBox="0 0 720 720"`.
São vetores reais, sem imagens raster incorporadas e sem dependência de fontes.

Arquivos: `ods-01.svg` a `ods-17.svg`. O `catalog.json` relaciona número, título,
URL local, página do objetivo, URL do SVG original, tamanho e hash SHA-256.

Os ativos são servidos pelo frontend no caminho `/images/ods/`:

```html
<img
  src="/images/ods/ods-04.svg"
  alt="ODS 4 — Educação de qualidade"
  width="120"
  height="120"
/>
```

Use o título do catálogo para o texto alternativo. Se o nome completo do ODS já
estiver visível junto da imagem e a imagem for decorativa, use `alt=""`.
Preserve a proporção quadrada, a integridade do ícone e as cores, inclusive no
tema escuro; não aplicar recorte, recoloração, máscara ou inversão automática.

## Fonte e orientações de uso

O material gráfico pertence à ONU e deve ser utilizado segundo as suas
orientações, sem sugerir endosso ao SUMI. As orientações abrangem o uso integral
dos ícones, preservação das cores e condições específicas para uso comercial,
arrecadação e publicações. Não se trata do emblema institucional da ONU.

- [ONU Brasil — uso de logomarcas](https://brasil.un.org/pt-br/80916-uso-de-logomarcas-da-onu).
- [ONU — materiais de comunicação e orientações vigentes](https://www.un.org/sustainabledevelopment/news/communications-material/).
- [Diretrizes dos ícones e identidade ODS, setembro de 2023](https://www.un.org/sustainabledevelopment/wp-content/uploads/2023/09/E_SDG_Guidelines_Sep20238.pdf).

Ao incorporar os ícones em materiais públicos, observar também a orientação da
ONU sobre incluir o link para https://www.un.org/sustainabledevelopment e a
declaração de que o conteúdo não foi aprovado pela ONU e não representa as
opiniões da organização, de seus agentes ou Estados-membros. A redação oficial
está disponível na página de materiais de comunicação.

Esta pasta disponibiliza os ativos para uso posterior; não altera as telas,
não associa ODS automaticamente aos eixos e não cria uma fonte remota em tempo
de execução.
