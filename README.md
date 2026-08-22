# Diretoria — Fundação V0.1

Primeira base executável do projeto **Diretoria / Diretoria Club**.

Esta entrega implementa o início do **Incremento 0 — Fundação** e prepara o primeiro vertical slice do núcleo econômico.

## O que já existe

- documentação canônica em `docs/`;
- `goal.md` e `AGENTS.md` na raiz;
- estrutura de monorepo;
- API mínima com health/readiness;
- painel administrativo placeholder para identificação de ambiente;
- domínio TypeScript sem dependências externas;
- testes automatizados das invariantes principais;
- PostgreSQL 18.6 local via Docker Compose;
- migration inicial do primeiro vertical slice;
- RBAC base;
- auditoria append-only prevista no schema;
- subledger financeiro previsto no schema;
- scripts de verificação de segredos e migrations;
- workflow de CI;
- pasta `relatorios/` com status e evidências desta entrega.

## Regras canônicas preservadas

- pagamento pendente não aumenta quórum;
- quórum é financeiro;
- bar esperado não entra na viabilidade;
- `VIAVEL != CONFIRMADO`;
- GO/NO-GO negativo bloqueia confirmação;
- capital protegido é derivado;
- fatos financeiros são imutáveis/corrigidos por reversão;
- ações críticas são auditáveis.

## Rodar testes

Requer Node.js 22.16+; deployment/HML recomendado em Node 24 LTS.

```bash
npm test
npm run check
```

## Subir PostgreSQL local

```bash
docker compose up -d db
```

Depois:

```bash
npm run db:migrate:docker
```

No Windows, também existe:

```powershell
./scripts/bootstrap.ps1
```

## API mínima

```bash
npm run api
```

- `GET /healthz`
- `GET /readyz`
- `GET /version`

## Admin mínimo

```bash
npm run admin
```

Abre em `http://localhost:3100`.

## Próxima implementação

Concluir HML-G0 e iniciar o núcleo econômico do Incremento 1:

`edição → config financeira → custos → receitas garantidas → pagamento HML → crédito → quórum → reembolso → GO/NO-GO`

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
