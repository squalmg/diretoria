# Banco de dados

PostgreSQL 18.6 para DEV local.

## Migrations iniciais

- `0001_core_foundation.sql`: primeiro vertical slice lógico.
- `0002_seed_rbac.sql`: papéis e permissões base, sem atribuir nenhum usuário.

## Regra

Nenhuma migration deve ser aplicada manualmente em produção fora do pipeline homologado.

O balanceamento de `financial_postings` será validado pelo serviço financeiro dentro de transação; uma constraint simples de linha não consegue garantir soma débito=crédito entre múltiplas linhas.
