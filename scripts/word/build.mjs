import { build } from 'esbuild';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../../vendor/docx/', import.meta.url));
await mkdir(dir, { recursive: true });
await build({ entryPoints: [fileURLToPath(new URL('entry.mjs', import.meta.url))], outfile: dir + 'docx.mjs',
  bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'eof' });
await copyFile(fileURLToPath(new URL('node_modules/docx/LICENSE', import.meta.url)), dir + 'LICENSE');
const notices = [];
for (const name of (await readdir(fileURLToPath(new URL('node_modules/', import.meta.url)))).filter(n => !n.startsWith('.') && !n.startsWith('@') && n !== 'esbuild').sort()) {
  const base = new URL('node_modules/' + name + '/', import.meta.url);
  const pkg = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
  for (const file of (await readdir(fileURLToPath(base))).filter(n => /^(license|licence|copying)(\.|$)/i.test(n))) {
    notices.push(`${name} ${pkg.version} (${pkg.license || 'see license'})\n${await readFile(new URL(file, base), 'utf8')}`);
  }
}
await writeFile(dir + 'THIRD_PARTY_NOTICES.txt', notices.join('\n\n--------------------\n\n'));
const sha256 = createHash('sha256').update(await readFile(dir + 'docx.mjs')).digest('hex');
await writeFile(dir + 'manifest.json', JSON.stringify({ name: 'docx', version: '9.6.1', source: 'https://github.com/dolanmiu/docx', license: 'MIT', sha256 }, null, 2) + '\n');
console.log('Built docx 9.6.1 browser module:', sha256);
