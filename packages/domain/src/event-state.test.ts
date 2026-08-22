import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionEvent } from './event-state.ts';

test('edição não nasce pulando diretamente para CONFIRMADO', () => {
  assert.equal(canTransitionEvent('PLANEJAMENTO', 'CONFIRMADO'), false);
});

test('VIAVEL pode voltar ao quórum se a proteção financeira cair antes da confirmação', () => {
  assert.equal(canTransitionEvent('VIAVEL', 'QUORUM_EM_ANDAMENTO'), true);
});

test('VIAVEL pode seguir para CONFIRMADO somente via caso de uso validado', () => {
  assert.equal(canTransitionEvent('VIAVEL', 'CONFIRMADO'), true);
});
