import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(process.argv[2] || 'dist');
if (!fs.existsSync(path.join(root, 'index.html')))
    throw Error('Exporte o App Web antes de preparar a PWA.');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(root).filter(f => !f.endsWith('offline-build.json') && !f.endsWith('.map') && !f.endsWith('sw.js') && !f.endsWith('sw-template.js') && (!f.endsWith('.html') || ['index.html', 'offline.html'].includes(path.basename(f))));
const template = fs.readFileSync(new URL('../public/sw-template.js', import.meta.url), 'utf8');
const hash = createHash('sha256').update(template);
for (const file of files.sort())
    hash.update(path.relative(root, file)).update(file.endsWith('.html') ? fs.readFileSync(file, 'utf8').replace(/<meta name="katua-build"[^>]*\/>/g, '') : fs.readFileSync(file));
const version = hash.digest('hex').slice(0, 16);
const urls = files.map(f => '/' + path.relative(root, f).split(path.sep).map(v => encodeURIComponent(v).replace(/%40/gi, '@')).join('/'));
fs.writeFileSync(path.join(root, 'sw.js'), template.replace('__KATUA_VERSION__', JSON.stringify(version)).replace('__KATUA_ASSETS__', JSON.stringify(urls)));
for (const file of walk(root).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf8').replace(/<meta name="katua-build"[^>]*\/>/g, '').replace('</head>', `<meta name="katua-build" content="${version}"/></head>`);
    fs.writeFileSync(file, html);
}
fs.rmSync(path.join(root, 'sw-template.js'), { force: true });
fs.writeFileSync(path.join(root, 'offline-build.json'), JSON.stringify({ version, files: urls.length }));
console.log(`PWA ${version}: ${urls.length} arquivos preparados para abertura offline.`);
