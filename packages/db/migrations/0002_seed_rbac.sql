BEGIN;

INSERT INTO roles(code, name, description) VALUES
  ('super_admin','Super Admin','Acesso administrativo integral'),
  ('finance','Financeiro','Finanças, pagamentos, conciliação e DRE'),
  ('production','Produção','Fornecedores, contratos e checklists'),
  ('marketing','Marketing','CRM, campanhas e analytics permitidos'),
  ('support','Atendimento','Clientes e operações permitidas'),
  ('gate_supervisor','Portaria Supervisor','Gestão da portaria'),
  ('scanner','Scanner','Somente validação de ingresso'),
  ('bar','Bar','Operação de bar autorizada')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, description) VALUES
  ('events.read','Ler edições'),
  ('events.write','Editar dados permitidos de edições'),
  ('events.confirm','Confirmar edição após gates'),
  ('payments.read','Ler pagamentos'),
  ('payments.refund','Executar fluxo autorizado de reembolso'),
  ('finance.read','Ler financeiro'),
  ('finance.write','Registrar fatos financeiros permitidos'),
  ('tickets.read','Ler ingressos'),
  ('tickets.scan','Validar/consumir ingresso'),
  ('tickets.block','Bloquear ingresso'),
  ('audit.read','Ler auditoria')
ON CONFLICT (code) DO NOTHING;

-- Permissões específicas serão refinadas no vertical slice. Nada concede acesso automaticamente a usuários.
COMMIT;
