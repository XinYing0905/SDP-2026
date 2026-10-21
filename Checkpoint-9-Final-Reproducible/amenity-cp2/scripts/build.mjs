import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist');
await fs.mkdir(output, { recursive: true });
// Generated modular delivery files, not canonical source. Does not bundle into a page.
await fs.cp(path.join(root, 'src'), path.join(output, 'src'), { recursive: true });
await fs.cp(path.join(root, 'frontend'), path.join(output, 'frontend'), { recursive: true });
await fs.copyFile(path.join(root, 'frontend/index.html'), path.join(output, 'index.html'));
console.log('Built modular frontend + service modules into dist; legacy test shims retained.');
