// vlibras-plugin.js é carregado por uma tag <script> comum logo antes desta,
// então em teoria já terminou quando chegamos aqui — mas em conexões mais
// lentas (rede externa à ...gov.br) o navegador pode levar mais tempo pra
// buscá-lo, e window.VLibras ainda não existe no instante em que este script
// roda. Sem repetir a tentativa, o widget nunca aparecia e não ficava nenhum
// aviso: parecia só "o botão de Libras não faz nada".
(function initVLibras(tentativas) {
  if (window.VLibras) { new window.VLibras.Widget('https://vlibras.gov.br/app'); return; }
  if (tentativas <= 0) { console.warn('[VLibras] widget não carregou — vlibras-plugin.js pode ter sido bloqueado ou não respondeu.'); return; }
  setTimeout(() => initVLibras(tentativas - 1), 500);
})(20);
