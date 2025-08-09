// netlify/functions/datas.ts
import type { Handler } from '@netlify/functions';
import fs from 'fs';
import path from 'path';

type Section = 'CrSt'|'EcSt'|'StSp'|'PrSp'|'Latent';

const SECTION_MANIFEST: Record<Section, string> = {
  CrSt:  path.join(process.cwd(), 'public', 'repo', 'CrSt', 'manifest.json'),
  EcSt:  path.join(process.cwd(), 'public', 'repo', 'EcSt', 'manifest.json'),
  StSp:  path.join(process.cwd(), 'public', 'repo', 'StSp', 'manifest.json'),
  PrSp:  path.join(process.cwd(), 'public', 'repo', 'PrSp', 'manifest.json'),
  Latent:path.join(process.cwd(), 'public', 'repo', 'Latent', 'manifest.json'),
};

const ok = (b: string, t='application/json') => ({
  statusCode: 200,
  headers: { 'Content-Type': t, 'Cache-Control': 'public, max-age=300' },
  body: b,
});
const nf = (m: string) => ({ statusCode: 404, body: JSON.stringify({ error: m }) });
const bad = (m: string) => ({ statusCode: 400, body: JSON.stringify({ error: m }) });

function readJson(p: string){
  if (!fs.existsSync(p)) throw Object.assign(new Error('file not found'), { code: 'ENOENT', path: p });
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

// city filtresi
function filterByCity(data: any, city?: string) {
  if (!city || city.toLowerCase() === 'all') return data;
  const key = 'cityname-tr';
  if (Array.isArray(data)) return data.filter((r) => r && String(r[key]) === city);
  if (data && typeof data === 'object') {
    const o: any = Array.isArray(data) ? [] : { ...data };
    for (const k of Object.keys(o)) {
      if (Array.isArray(o[k])) o[k] = o[k].filter((r: any) => r && String(r[key]) === city);
    }
    return o;
  }
  return data;
}

// base key normalizasyonu
function normalizeKeyBase(section: Section, viz: string, topic: string, digit: string, year: string) {
  if (section === 'EcSt' && viz === 'heatmap') {
    return `${section}:${viz}:${topic}:none:${year}`;
  }
  if (section === 'EcSt' && viz === 'timeline') {
    return `${section}:${viz}:${topic}:${digit}:all`;
  }
  return `${section}:${viz}:${topic}:${digit}:${year}`;
}

function resolveManifestRecord(section: Section, baseKey: string) {
  const manPath = SECTION_MANIFEST[section];
  const idx = readJson(manPath);
  const rec = idx[baseKey];
  if (!rec) return null;
  return { file: path.join(process.cwd(), 'public', rec.file) };
}

function parseV1Path(p: string){
  // /datas/v1/:section/:topic/:digit/:year/:viz
  const parts = p.split('/').filter(Boolean);
  const v1 = parts.indexOf('v1');
  if (v1 === -1 || parts.length < v1 + 6) return null;
  const section = parts[v1+1] as Section;
  const topic = parts[v1+2];
  const digit = parts[v1+3];
  const year  = parts[v1+4];
  const viz   = parts[v1+5];
  return { section, topic, digit, year, viz };
}

function parseSourcePath(p: string){
  // /datas/source/<...> (.json uzantısı opsiyonel)
  const parts = p.split('/').filter(Boolean);
  const src = parts.indexOf('source');
  if (src === -1) return null;
  const rest = parts.slice(src+1).join('/');
  return rest.endsWith('.json') ? rest : (rest + '.json');
}

export const handler: Handler = async (event) => {
  try {
    const urlPath = (event.path || '').replace(/^\/datas\/?/, '');
    const city = (event.queryStringParameters?.cityname || event.queryStringParameters?.city || '').trim();

    // 1) raw passthrough
    const srcRel = parseSourcePath(urlPath);
    if (srcRel) {
      const fpath = path.join(process.cwd(), 'public', srcRel);
      const data = readJson(fpath);
      const filtered = filterByCity(data, city || undefined);
      return ok(JSON.stringify(filtered));
    }

    // 2) v1 router
    const v1 = parseV1Path(urlPath);
    if (!v1) return bad('Unsupported path. Use /datas/source/... or /datas/v1/:section/:topic/:digit/:year/:viz');

    const { section, topic, digit, year, viz } = v1;
    const baseKey = normalizeKeyBase(section, viz, topic, digit, year);
    const rec = resolveManifestRecord(section, baseKey);
    if (!rec) return nf(`manifest key not found: ${baseKey}`);

    const data = readJson(rec.file);
    const filtered = filterByCity(data, city || undefined);
    return ok(JSON.stringify(filtered));
  } catch (e:any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
