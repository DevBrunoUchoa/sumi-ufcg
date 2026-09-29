const icons = {
  1: { name: 'ensino', url: new URL('./assets/eixos/ensino-simbolo.svg', import.meta.url).href },
  2: { name: 'pesquisa e inovacao', url: new URL('./assets/eixos/pesquisa-inovacao-simbolo.svg', import.meta.url).href },
  3: { name: 'extensao', url: new URL('./assets/eixos/extensao-simbolo.svg', import.meta.url).href },
  4: { name: 'assistencia estudantil', url: new URL('./assets/eixos/assistencia-estudantil-simbolo.svg', import.meta.url).href },
  5: { name: 'internacionalizacao', url: new URL('./assets/eixos/internacionalizacao-simbolo.svg', import.meta.url).href },
  6: { name: 'infraestrutura', url: new URL('./assets/eixos/infraestrutura-simbolo.svg', import.meta.url).href },
  7: { name: 'gestao de pessoas', url: new URL('./assets/eixos/gestao-de-pessoas-simbolo.svg', import.meta.url).href },
  8: { name: 'governanca e gestao', url: new URL('./assets/eixos/governanca-gestao-simbolo.svg', import.meta.url).href },
};

const normalize = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function axisIconFor(planType, axis) {
  if (planType !== 'PDI' || !axis) return null;
  const code = String(axis.code ?? '').trim().replace(/^0+(?=\d)/, '');
  const icon = icons[code];
  if (!icon || !normalize(axis.name).includes(icon.name)) return null;
  return icon.url;
}
