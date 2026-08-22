export type EventStatus =
  | 'PLANEJAMENTO'
  | 'REATIVACAO'
  | 'LISTA_DE_ESPERA'
  | 'FORMACAO'
  | 'QUORUM_EM_ANDAMENTO'
  | 'VIAVEL'
  | 'CONFIRMADO'
  | 'VENDA_PUBLICA'
  | 'PRE_EVENTO'
  | 'AO_VIVO'
  | 'FECHAMENTO'
  | 'ENCERRADO'
  | 'RETENCAO';

const allowed: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  PLANEJAMENTO: ['REATIVACAO'],
  REATIVACAO: ['LISTA_DE_ESPERA'],
  LISTA_DE_ESPERA: ['FORMACAO'],
  FORMACAO: ['QUORUM_EM_ANDAMENTO'],
  QUORUM_EM_ANDAMENTO: ['VIAVEL'],
  VIAVEL: ['QUORUM_EM_ANDAMENTO', 'CONFIRMADO'],
  CONFIRMADO: ['VENDA_PUBLICA'],
  VENDA_PUBLICA: ['PRE_EVENTO'],
  PRE_EVENTO: ['AO_VIVO'],
  AO_VIVO: ['FECHAMENTO'],
  FECHAMENTO: ['ENCERRADO'],
  ENCERRADO: ['RETENCAO'],
  RETENCAO: ['PLANEJAMENTO'],
};

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return allowed[from].includes(to);
}

export function assertEventTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransitionEvent(from, to)) {
    throw new Error(`EVENT_TRANSITION_NOT_ALLOWED:${from}->${to}`);
  }
}
