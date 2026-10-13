import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const tests = readdirSync(new URL('../tests/', import.meta.url)).sort();
const checks = [
  [process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']],
  [process.execPath, ['--experimental-strip-types', '--test', ...tests.filter(file => file.endsWith('.test.ts')).map(file => `tests/${file}`)]],
  ...tests.filter(file => file.endsWith('_invariants.py')).map(file => ['python3', [`tests/${file}`]]),
];
for (const [command, args] of checks) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nAll checks passed.');
