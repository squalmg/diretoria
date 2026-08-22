$ErrorActionPreference = 'Stop'

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Criado .env local a partir de .env.example. Troque CHANGE_ME_LOCAL_ONLY antes de uso compartilhado.'
}

Write-Host 'Executando validações...'
npm run check

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Write-Host 'Subindo PostgreSQL local...'
  docker compose up -d db
  Write-Host 'Aguardando healthcheck do banco...'
  for ($i=0; $i -lt 30; $i++) {
    $status = docker inspect --format='{{.State.Health.Status}}' (docker compose ps -q db) 2>$null
    if ($status -eq 'healthy') { break }
    Start-Sleep -Seconds 2
  }
  npm run db:migrate:docker
  Write-Host 'Banco local inicializado.'
} else {
  Write-Host 'Docker não encontrado. Código e testes estão prontos; banco local não foi iniciado.'
}
