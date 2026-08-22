import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const files = ['apps/hml/index.html', 'apps/hml/writes.html'];
const temp = mkdtempSync(join(tmpdir(), 'diretoria-hml-check-'));
let checked = 0;

try {
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .filter((match) => !/\bsrc\s*=/.test(match[0]))
      .map((match) => match[1])
      .filter((source) => source.trim());
    if (!scripts.length) throw new Error(`NO_INLINE_SCRIPT:${file}`);
    for (let index = 0; index < scripts.length; index += 1) {
      const target = join(temp, `${file.replaceAll('/', '_')}-${index}.js`);
      writeFileSync(target, scripts[index]);
      const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
      if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout || `Syntax error in ${file}\n`);
        process.exit(result.status ?? 1);
      }
      checked += 1;
    }
  }
  console.log(`OK: ${checked} script(s) HML com sintaxe JavaScript válida.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
