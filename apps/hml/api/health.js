export default function handler(request, response) {
  response.status(200).json({
    ok: true,
    service: 'diretoria-hml',
    environment: 'hml',
    foundation: '0.1',
    databaseProvider: 'supabase',
    databaseRegion: 'sa-east-1',
    source: 'squalmg/diretoria'
  });
}
