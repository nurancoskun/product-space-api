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

const manifests = { CrSt:{}, EcSt:{}, StSp:{}, PrSp:{}, Latent:{} };

function add(section, viz, topic, digit, year, rel) {
  const key = `${section}:${viz}:${topic}:${digit}:${year}`;
  manifests[section][key] = { file: `repo/source/${rel.replace(/\\/g,'/')}` };
}

function walk(dir, fn){
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, fn);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) fn(p);
  }
}

walk(SRC, (full) => {
  const rel = path.relative(SRC, full).replace(/\\/g,'/');
  const parts = rel.split('/');

  // CrSt: CrSt:topic:digit:year
  // public/repo/source/CrSt/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'CrSt' && parts.length >= 5) {
    const [, topic, digit, year] = parts;
    add('CrSt', 'CrSt', topic, digit, year, rel);
    return;
  }

  // EcSt pie: EcSt:pie:topic:digit:year
  // public/repo/source/EcSt/pie/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'EcSt' && parts[1] === 'pie' && parts.length >= 6) {
    const [, viz, topic, digit, year] = parts;
    add('EcSt', viz, topic, digit, year, rel);
    return;
  }

  // EcSt timeline: EcSt:timeline:topic:digit:all  (year klasörü yok)
  // public/repo/source/EcSt/timeline/<topic>/<digit>/data.json
  if (parts[0] === 'EcSt' && parts[1] === 'timeline' && parts.length >= 5) {
    const [, viz, topic, digit] = parts;
    add('EcSt', viz, topic, digit, 'all', rel);
    return;
  }

  // EcSt heatmap: EcSt:heatmap:topic:digit:year
  // public/repo/source/EcSt/heatmap/<topic>/<digit>/<year>/data.json   (dikkat: sırayı sabitledik)
  if (parts[0] === 'EcSt' && parts[1] === 'heatmap' && parts.length >= 6) {
    const [, viz, topic, digit, year] = parts;
    add('EcSt', viz, topic, digit, year, rel);
    return;
  }

  // StSp: StSp:StSp:topic:digit:year
  // public/repo/source/StSp/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'StSp' && parts.length >= 5) {
    const [, topic, digit, year] = parts;
    add('StSp', 'StSp', topic, digit, year, rel);
    return;
  }

  // PrSp: PrSp:<viz>:topic:digit:year  (viz = PrSpaceNACE|PrSpaceGTIP|PrSpaceGTIPWorld)
  // public/repo/source/PrSp/<viz>/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'PrSp' && parts.length >= 6 && ['PrSpaceNACE','PrSpaceGTIP','PrSpaceGTIPWorld'].includes(parts[1])) {
    const [, viz, topic, digit, year] = parts;
    add('PrSp', viz, topic, digit, year, rel);
    return;
  }

  // Latent: Latent:<viz>:topic:digit:year  (viz = Latent1..Latent4)
  // public/repo/source/Latent/<viz>/<topic>/<digit>/<year>/data.json
  if (parts[0] === 'Latent' && parts.length >= 6 && /^Latent[1-4]$/.test(parts[1])) {
    const [, viz, topic, digit, year] = parts;
    add('Latent', viz, topic, digit, year, rel);
    return;
  }
});

// yaz + log
for (const sec of Object.keys(OUTS)) {
  const out = OUTS[sec];
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const data = manifests[sec] || {};
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`${sec} entries:`, Object.keys(data).length);
}
console.log('OK: manifests built.');
