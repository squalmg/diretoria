import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ignored = new Set(['.git','node_modules','artifacts']);
const allowFiles = new Set(['.env.example','scripts/check-secrets.mjs']);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:password|passwd|secret|token|api[_-]?key)\b\s*[:=]\s*["']?(?!CHANGE_ME|example|placeholder)[A-Za-z0-9_\-\.]{16,}/i,
];

function walk(dir) {
  const files = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else if (statSync(p).size < 2_000_000) files.push(p);
  }
  return files;
}

const violations = [];
for (const file of walk('.')) {
  const rel = relative('.', file).replaceAll('\\','/');
  if (allowFiles.has(rel)) continue;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const line of text.split(/\r?\n/)) {
    if (line.includes('CHANGE_ME_') || line.includes('ci_only_password') || line.includes('${POSTGRES_PASSWORD')) continue;
    for (const p of patterns) if (p.test(line)) violations.push(`${rel}: ${p}`);
  }
}

if (violations.length) {
  console.error('Possíveis segredos encontrados:\n' + violations.join('\n'));
  process.exit(1);
}
console.log('OK: nenhum segredo óbvio encontrado.');
