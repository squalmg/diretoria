import http from 'node:http';

const port = Number(process.env.API_PORT ?? '3001');
const appEnv = process.env.APP_ENV ?? 'dev';
const startedAt = new Date().toISOString();

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const requestId = crypto.randomUUID();
  res.setHeader('x-request-id', requestId);

  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { status: 'ok', service: 'diretoria-api', env: appEnv, requestId });
  }

  if (req.method === 'GET' && req.url === '/readyz') {
    // A prontidão de DB será adicionada quando o adapter PostgreSQL entrar no vertical slice.
    return json(res, 200, { status: 'ready-foundation', db: 'not-wired-yet', requestId });
  }

  if (req.method === 'GET' && req.url === '/version') {
    return json(res, 200, { version: '0.1.0-foundation', startedAt, requestId });
  }

  return json(res, 404, { code: 'NOT_FOUND', requestId });
});

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', msg: 'api_started', port, env: appEnv, startedAt }));
});
