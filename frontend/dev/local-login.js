import { developmentSessions } from './session-fixtures.js';

// Contas fictícias exclusivas do middleware Vite; não são usuários do banco.
export const developmentAccounts = Object.freeze([
  { profile: 'administrator', email: developmentSessions.administrator.user.email, password: 'SumiLocal123!' },
  { profile: 'axis_contributor', email: developmentSessions.axis_contributor.user.email, password: 'SumiLocal123!' },
  { profile: 'axis_reviewer', email: developmentSessions.axis_reviewer.user.email, password: 'SumiLocal123!' },
]);

export function handleDevelopmentLogin(request, response) {
  const send = (status, body, profile) => {
    if (response.writableEnded) return;
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    if (profile) response.setHeader('Set-Cookie', `sumi_dev_session=${profile}; Path=/; HttpOnly; SameSite=Lax`);
    response.end(JSON.stringify(body));
  };
  const chunks = [];
  let bytes = 0;
  request.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > 8192) { send(413, { error: 'payload_too_large' }); return; }
    chunks.push(chunk);
  });
  request.on('error', () => send(400, { error: 'invalid_request' }));
  request.on('end', () => {
    if (response.writableEnded) return;
    let credentials;
    try { credentials = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { send(400, { error: 'invalid_json' }); return; }
    const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
    const account = developmentAccounts.find((account) => account.email === email && account.password === credentials?.senha);
    if (!account) { send(401, { error: 'invalid_credentials' }); return; }
    send(200, { ok: true }, account.profile);
  });
}
