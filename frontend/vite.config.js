import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { developmentSessions } from './dev/session-fixtures.js';
import { initialState } from './src/data.js';

// Middleware exclusivo do servidor de desenvolvimento (apply: 'serve') —
// simula GET /api/v1/auth/session e GET /__dev/planning/workspace para que a
// interface funcione sem o backend real enquanto se desenvolve só o
// frontend. Nunca entra no build de produção (dist/frontend), que fala
// exclusivamente com a API HTTP real (ver src/auth/session-client.js e
// src/planning-client.js, e docs/architecture.md).
function developmentSession() {
  return {
    name: 'sumi-development-session',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method === 'GET' && request.url?.split('?')[0] === '/__dev/planning/workspace') {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify(initialState()));
          return;
        }
        const profileMatch = request.url?.match(/^\/__dev\/session\/(administrator|public|axis_contributor|axis_reviewer)$/);
        if (request.method === 'GET' && profileMatch) {
          response.statusCode = 302;
          response.setHeader('Set-Cookie', `sumi_dev_session=${profileMatch[1]}; Path=/; SameSite=Lax`);
          response.setHeader('Location', '/');
          response.end();
          return;
        }
        if (request.method !== 'GET' || request.url?.split('?')[0] !== '/api/v1/auth/session') return next();
        const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('sumi_dev_session='));
        const selected = cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : 'administrator';
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify(developmentSessions[selected] || developmentSessions.administrator));
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  // O middleware de sessão de desenvolvimento só entra quando ninguém pediu
  // explicitamente a API real (VITE_DATA_SOURCE=http) — permite rodar
  // `pnpm --filter frontend dev` contra o backend/Supabase de verdade.
  plugins: [tailwindcss(), ...(mode === 'development' && process.env.VITE_DATA_SOURCE !== 'http' ? [developmentSession()] : [])],
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
}));
