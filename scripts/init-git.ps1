$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.git')) { git init -b main }
git add .
git status --short
Write-Host ''
Write-Host 'Fundação preparada. Revise e então faça o primeiro commit.'
Write-Host 'Repositório remoto esperado quando existir: https://github.com/squalmg/diretoria'
