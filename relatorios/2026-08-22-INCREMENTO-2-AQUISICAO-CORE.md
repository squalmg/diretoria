# Relatório — Incremento 2 / Núcleo de Aquisição e CRM

**Data:** 22/08/2026  
**Projeto:** Diretoria  
**Ambiente:** HML

## Objetivo

Construir a base P0 necessária antes de publicar qualquer formulário de lista de espera ou investir em primeiro anúncio.

O princípio aplicado foi:

> O site público só deve começar a captar contatos depois que identidade, consentimento, atribuição e CRM estiverem consistentes e testados.

## Entregas

### Migration 0015

`packages/db/migrations/0015_acquisition_crm_foundation.sql`

Cria:

- consentimentos;
- atribuições;
- histórico de estágio CRM;
- interações CRM;
- eventos analíticos;
- acervo;
- tags de acervo.

Todas as tabelas públicas novas entram com RLS habilitado e sem policies permissivas neste slice.

### PostgresAcquisitionCore

Arquivo:

`packages/db/src/acquisition-core.ts`

Responsabilidades:

- normalizar e-mail;
- validar telefone E.164;
- exigir contato mínimo;
- exigir consentimento de privacidade;
- serializar capturas concorrentes por identidade com advisory locks transacionais;
- localizar profile por e-mail e/ou telefone;
- detectar colisão de identidades;
- criar ou consolidar profile;
- registrar atribuição completa;
- registrar decisões de consentimento;
- registrar estágio CRM sem regressão de lifecycle;
- registrar interação;
- registrar analytics;
- registrar auditoria.

## Integridade de identidade

### Deduplicação

Duas capturas usando o mesmo e-mail/telefone retornam o mesmo `profile_id`.

### Colisão

Se o e-mail pertence ao profile A e o telefone pertence ao profile B, a captura falha com:

`IDENTITY_COLLISION`

Nenhuma atribuição ou consentimento parcial permanece após o rollback.

### Concorrência

Antes de consultar/criar o profile, o core adquire advisory locks transacionais sobre as chaves de identidade normalizadas. Isso reduz o risco de duas requisições concorrentes criarem pessoas duplicadas.

## Consentimento

Privacidade é obrigatória para a captura.

As decisões são registradas individualmente para:

- privacy;
- marketing;
- WhatsApp;
- e-mail.

O sistema persiste tanto `true` quanto `false`, evitando inferir consentimento pela ausência de registro.

Cada decisão contém versão da política e origem.

## CRM

Novo profile recebe estágio `lead`.

Captura repetida não cria novo estágio `lead` desnecessariamente.

Se a pessoa já alcançou estágio posterior como `member`, nova campanha não regride seu lifecycle.

Um profile `inactive` pode ser reativado para `lead`, preservando o histórico.

## Analytics

Cada captura válida registra `lead_created` com propriedades de campanha.

Analytics permanece separado da fonte transacional de verdade: falhas/regras financeiras não dependem dessa tabela.

## CI

Run de homologação:

`32566983116`

PASS:

- domínio existente;
- secrets;
- migrations;
- HML JS;
- schema/RLS;
- sessão HML;
- core econômico;
- aquisição/CRM;
- backup/restore.

Cenários específicos validados:

1. nova identidade;
2. e-mail normalizado;
3. telefone E.164;
4. opt-in/opt-out;
5. captura repetida;
6. preservação de `member`;
7. colisão e rollback;
8. privacy gate;
9. auditoria;
10. restauração de consentimentos em backup.

## Supabase HML

Migration `0015_acquisition_crm_foundation` aplicada com sucesso ao projeto:

`heckakjcpwomoucobtau`

Advisors após a migration:

- segurança: apenas INFO `rls_enabled_no_policy`, intencional por default-deny;
- performance: apenas INFO `unused_index`, esperado antes de existir tráfego público;
- nenhum novo ERROR/WARN de segurança;
- nenhuma FK nova sem índice reportada.

## Próximo slice

Criar a fronteira pública controlada:

`POST /leads`

E então a primeira Home/Lista de Espera em HML.

A API deve:

- aceitar somente payload limitado;
- normalizar telefone brasileiro no boundary ou exigir E.164 claramente;
- aplicar rate limit/anti-abuso antes da abertura pública;
- não expor banco/PostgREST diretamente;
- chamar o `PostgresAcquisitionCore` canônico;
- retornar apenas identificador/estado mínimo;
- não revelar se um e-mail já existe de forma explorável.

**Desenvolvido por [Clan Digital](https://clanmarketing.com.br/)**
