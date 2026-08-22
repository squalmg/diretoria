import { existsSync, readFileSync } from 'node:fs';

const required = ['goal.md','AGENTS.md','docs/06-backlog-v1.md','docs/08-plano-hml-e-testes.md','relatorios/STATUS-ATUAL.md'];
const missing = required.filter(x => !existsSync(x));
if (missing.length) {
  console.error('Docs obrigatórios ausentes:', missing);
  process.exit(1);
}
const goal = readFileSync('goal.md','utf8');
for (const rule of ['Quórum é financeiro','O bar não financia a viabilidade','GO/NO-GO']) {
  if (!goal.includes(rule)) {
    console.error(`Regra canônica ausente do goal: ${rule}`);
    process.exit(1);
  }
}
console.log('OK: documentação canônica mínima presente.');
