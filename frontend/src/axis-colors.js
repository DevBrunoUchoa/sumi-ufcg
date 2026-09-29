// Cores extraídas dos oito blocos da Figura 25 enviada para os eixos temáticos.
// O mesmo número usa a mesma cor nos formulários de estrutura do PDI e do PLS.
export const AXIS_COLORS = Object.freeze({
  1: '#1b9afb', // Ensino
  2: '#009330', // Pesquisa e inovação
  3: '#a19177', // Extensão
  4: '#016168', // Assistência Estudantil
  5: '#e39010', // Internacionalização
  6: '#8b4b0e', // Infraestrutura, acessibilidade e inclusão
  7: '#c23929', // Gestão de Pessoas
  8: '#b5336f', // Governança e Gestão
});

export function axisColorFor(planType, code) {
  if (planType !== 'PDI' && planType !== 'PLS') return null;
  const number = String(code).trim().replace(/^0+(?=\d)/, '');
  if (planType === 'PLS' && number === '8') return null;
  return AXIS_COLORS[number] ?? null;
}
