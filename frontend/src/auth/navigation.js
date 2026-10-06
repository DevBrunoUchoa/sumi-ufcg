export function safeReturnPath(value) {
  if (typeof value !== 'string' || /[\\\r\n]/.test(value)) return '/inicio';
  return /^\/(inicio|planejamentos|pendencias|validacoes|modelos|usuarios|sobre|ajuda|privacidade)(\?|$)/.test(value) || /^\/plano\/[^/]+(?:\/eixo\/[^/?]+)?(?:\?|$)/.test(value) ? value : '/inicio';
}

export function loginUrl(route) {
  const destination = `${route.path}${route.query.size ? `?${route.query}` : ''}`;
  return `/login?${new URLSearchParams({ returnTo: safeReturnPath(destination) })}`;
}
