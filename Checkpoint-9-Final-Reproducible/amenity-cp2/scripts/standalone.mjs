// Verify the frozen CP2 artifact; never regenerate the modular application as one page.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const hashes = JSON.parse(await fs.readFile(new URL('../tests/baseline/approved-hashes.json', import.meta.url), 'utf8'));
const artifact = new URL('../artifacts/checkpoint-2/Amenity-Change-Evidence.html', import.meta.url);
const bytes = await fs.readFile(artifact);
if (crypto.createHash('sha256').update(bytes).digest('hex') !== hashes.offlineHtml) throw new Error('Approved portable CP2 artifact changed');
console.log('Frozen Checkpoint 2 offline HTML verified unchanged. It is not the modular application source.');
