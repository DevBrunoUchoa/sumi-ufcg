<h1 align="center">SUMI-UFCG</h1>

<p align="center">Sistema de gestão e acompanhamento de planos institucionais da Universidade Federal de Campina Grande.</p>

---

## Sobre o projeto

O SUMI-UFCG é desenvolvido no âmbito do Smart Campus da UFCG. O projeto propõe uma aplicação institucional para estruturar, acompanhar e registrar a execução de planos, preservando as particularidades dos processos conduzidos pela universidade.

---

## Ambiente de desenvolvimento

O repositório utiliza Node.js 24 e pnpm 11. As versões declaradas devem ser respeitadas para manter a instalação reproduzível entre os ambientes locais e a integração contínua.

```bash
corepack enable
pnpm install --frozen-lockfile
```

As configurações locais são derivadas de `.env.example`. Credenciais e dados institucionais permanecem fora do histórico do Git.

---

## Infraestrutura

A configuração inicial de runtime, ambiente e integração contínua está descrita em [`docs/infrastructure.md`](docs/infrastructure.md). A containerização será incorporada após a definição dos comandos de build e inicialização da aplicação.
