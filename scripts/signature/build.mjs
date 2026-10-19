import { build } from 'esbuild';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = fileURLToPath(new URL('.', import.meta.url)), out = fileURLToPath(new URL('../../vendor/signature/', import.meta.url));
await mkdir(out, { recursive: true });
for (const name of ['pad', 'digital']) await build({ entryPoints: [here + name + '-entry.mjs'], outfile: out + name + '.mjs', platform: 'browser', format: 'esm', bundle: true, minify: true, target: 'es2022', legalComments: 'eof', inject: [here + 'buffer-shim.mjs'] });
const notices = [];
async function collect(base) {
  for (const name of (await readdir(base)).sort()) {
    if (name.startsWith('.')) continue;
    if (name.startsWith('@')) { await collect(base + name + '/'); continue; }
    if (name === 'esbuild') continue;
    const folder = base + name + '/';
    const pkg = JSON.parse(await readFile(folder + 'package.json', 'utf8'));
    for (const file of (await readdir(folder)).filter(n => /^(license|licence|copying)(\.|$)/i.test(n))) notices.push(`${pkg.name} ${pkg.version}\n${await readFile(folder + file, 'utf8')}`);
  }
}
await collect(here + 'node_modules/');
await writeFile(out + 'THIRD_PARTY_NOTICES.txt', notices.join('\n\n--------------------\n\n').replace(/\r\n/g, '\n'));
const files = {};
for (const file of ['pad.mjs', 'digital.mjs']) files[file] = createHash('sha256').update(await readFile(out + file)).digest('hex');
await writeFile(out + 'manifest.json', JSON.stringify({ sources: ['https://github.com/szimek/signature_pad', 'https://github.com/vbuch/node-signpdf', 'https://github.com/digitalbazaar/forge', 'https://github.com/Hopding/pdf-lib'], versions: JSON.parse(await readFile(here + 'package.json')).dependencies, sha256: files }, null, 2) + '\n');
console.log('Signature runtimes built', files);
