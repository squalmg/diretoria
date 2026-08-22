export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const upstream = await fetch(
      'https://heckakjcpwomoucobtau.supabase.co/functions/v1/diretoria-admin-api/health',
      { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } },
    );
    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    response.send(text);
  } catch (error) {
    response.status(503).json({
      ok: false,
      code: 'EDGE_HEALTH_PROXY_FAILED',
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }
}
