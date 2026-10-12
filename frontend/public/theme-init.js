// Same-origin classic script: restores appearance before React without inline CSP exceptions.
try {
  const contrast = localStorage.getItem('sumi.ui.alto-contraste') === 'true';
  document.documentElement.dataset.theme = !contrast && localStorage.getItem('sumi.ui.dark-mode') === 'true' ? 'dark' : 'light';
  if (document.documentElement.dataset.theme === 'dark') {
    document.documentElement.style.backgroundColor = '#1c1d1f';
    document.documentElement.style.colorScheme = 'dark';
  }
  if (contrast) document.documentElement.dataset.altoContraste = 'true';
} catch { document.documentElement.dataset.theme = 'light'; }
