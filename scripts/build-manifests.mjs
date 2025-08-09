// scripts/build-manifests.mjs
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('public/repo/source');

const OUTS = {
  CrSt:  path.resolve('public/repo/CrSt/manifest.json'),
  EcSt:  path.resolve('public/repo/EcSt/manifest.json'),
  StSp:  path.resolve('public/repo/StSp/manifest.json'),
  PrSp:  path.resolve('public/repo/PrSp/manifest.json'),
  Latent:path.resolve('public/repo/Latent/manifest.json'),
};

/**
 * Manifest anahtarları build-time'da CITY İÇERMEZ.
 * Run-time'da gelen anahtarlar şehirli gelir; base anahtara ('all' normalizasyonu) map edilir
 * ve JSON 'cityname-tr' ile filtrelenir. Böylece manifest şişmez.
 */
const manifests = { CrSt:{}, EcSt:{}, StSp:{}, PrSp:{}, Latent:{} };

function add(section, viz, topic, digit, year, rel) {
  const key = [section, viz, topic, digit, year].filter(Boolean).join(':');
  manifests[section][key] = { file: `repo/source/${rel.replace(/\\/g,'/')}` };
}

function walk(dir, fn){
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, fn);
    else if (ent.isFile() && /\.json$/i.test(ent.name)) fn(p);
  }
}

walk(SRC, (full) => {
  const rel = path.relative(SRC, full).replace(/\\/g,'/');
  const parts = rel.split('/');

  // CrSt/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'CrSt' && parts.length >= 5) {
    const [, topic, digit, year] = parts;
    add('CrSt', 'CrSt', topic, digit, year, rel);
    return;
  }

  // EcSt/pie/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'EcSt' && parts[1] === 'pie' && parts.length >= 6) {
    const [, viz, topic, digit, year] = parts;
    add('EcSt', viz, topic, digit, year, rel);
    return;
  }

  // EcSt/timeline/<topic>/<digit>/data.json  -> year='all'
  if (parts[0] === 'EcSt' && parts[1] === 'timeline' && parts.length >= 5) {
    const [, viz, topic, digit] = parts;
    add('EcSt', viz, topic, digit, 'all', rel);
    return;
  }

  // EcSt/heatmap/<topic>/<year>/data.json   -> digit YOK; manifest digit='none'
  if (parts[0] === 'EcSt' && parts[1] === 'heatmap' && parts.length >= 5) {
    const [, viz, topic, year] = parts;
    add('EcSt', viz, topic, 'none', year, rel);
    return;
  }

  // StSp/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'StSp' && parts.length >= 5) {
    const [, topic, digit, year] = parts;
    add('StSp', 'StSp', topic, digit, year, rel);
    return;
  }

  // PrSp/<viz>/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'PrSp' && parts.length >= 6 && ['PrSpaceNACE','PrSpaceGTIP','PrSpaceGTIPWorld'].includes(parts[1])) {
    const [, viz, topic, digit, year] = parts;
    add('PrSp', viz, topic, digit, year, rel);
    return;
  }

  // Latent/<viz>/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'Latent' && parts.length >= 6 && /^Latent[1-4]$/.test(parts[1])) {
    const [, viz, topic, digit, year] = parts;
    add('Latent', viz, topic, digit, year, rel);
    return;
  }
});

for (const sec of Object.keys(OUTS)) {
  const out = OUTS[sec];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const data = manifests[sec] || {};
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`${sec} entries:`, Object.keys(data).length);
}
console.log('OK: manifests built.');
