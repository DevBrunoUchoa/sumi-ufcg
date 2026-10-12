// Os 17 Objetivos de Desenvolvimento Sustentável (Agenda 2030, ONU) — títulos
// e cores oficiais (brand guidelines da ONU), usados para vincular objetivos
// do PDI aos ODS correspondentes.
export const ODS_GOALS = [
  { number: 1, title: 'Erradicação da Pobreza', color: '#E5243B' },
  { number: 2, title: 'Fome Zero e Agricultura Sustentável', color: '#DDA63A' },
  { number: 3, title: 'Saúde e Bem-Estar', color: '#4C9F38' },
  { number: 4, title: 'Educação de Qualidade', color: '#C5192D' },
  { number: 5, title: 'Igualdade de Gênero', color: '#FF3A21' },
  { number: 6, title: 'Água Potável e Saneamento', color: '#26BDE2' },
  { number: 7, title: 'Energia Limpa e Acessível', color: '#FCC30B' },
  { number: 8, title: 'Trabalho Decente e Crescimento Econômico', color: '#A21942' },
  { number: 9, title: 'Indústria, Inovação e Infraestrutura', color: '#FD6925' },
  { number: 10, title: 'Redução das Desigualdades', color: '#DD1367' },
  { number: 11, title: 'Cidades e Comunidades Sustentáveis', color: '#FD9D24' },
  { number: 12, title: 'Consumo e Produção Responsáveis', color: '#BF8B2E' },
  { number: 13, title: 'Ação Contra a Mudança Global do Clima', color: '#3F7E44' },
  { number: 14, title: 'Vida na Água', color: '#0A97D9' },
  { number: 15, title: 'Vida Terrestre', color: '#56C02B' },
  { number: 16, title: 'Paz, Justiça e Instituições Eficazes', color: '#00689D' },
  { number: 17, title: 'Parcerias e Meios de Implementação', color: '#19486A' },
];

export const odsGoal = (number) => ODS_GOALS.find((goal) => goal.number === number);
