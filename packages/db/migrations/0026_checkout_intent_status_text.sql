BEGIN;

-- Normaliza o tipo físico do estado do checkout para `text`, como já ocorre em
-- outros domínios de estado da Diretoria. A CHECK constraint existente continua
-- definindo o conjunto permitido; esta migration não adiciona novos estados.
--
-- Motivo técnico adicional: operações transacionais de lifecycle usam o mesmo
-- parâmetro de status em atribuição e comparação. `text` evita inferência
-- ambígua entre varchar/text no PostgreSQL sem depender de casts por chamada.
ALTER TABLE checkout_intents
  ALTER COLUMN status TYPE text USING status::text;

COMMIT;
