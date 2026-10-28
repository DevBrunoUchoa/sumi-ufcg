/** CPF só com dígitos — é como o GOV.BR devolve no `sub` e como fica no banco. */
export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** 11 dígitos, não todos iguais, com os dois dígitos verificadores corretos. */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string) => {
    const soma = [...base].reduce((total, d, i) => total + Number(d) * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}
