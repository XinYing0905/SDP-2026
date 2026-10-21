import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = path.resolve(import.meta.dirname, '../../checkpoint-3-clarification');
await fs.mkdir(directory, { recursive: true });
const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/detector.test.mjs', 'tests/architecture.test.mjs', 'tests/diagnosis.test.mjs', 'tests/diagnosis-clarification.test.mjs'], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' });
await fs.writeFile(path.join(directory, 'Automated-Test-Results.tap'), run.stdout + run.stderr);
console.log(run.stdout + run.stderr);
process.exitCode = run.status ?? 1;
