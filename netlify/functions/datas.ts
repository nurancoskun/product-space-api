
import type { Handler } from "@netlify/functions";

type Item = { path: string; meta: any };
let CACHE: Item[] | null = null;

async function loadIndex(): Promise<Item[]> {
  if (CACHE) return CACHE;
  const r = await fetch(`/.netlify/functions/static?file=repo/index.json`);
  if (!r.ok) throw new Error("index not found");
  CACHE = await r.json();
  return CACHE!;
}

function mapStatus(s: string) {
  const k = s.toLowerCase();
  if (k === "curst" || k === "currentstatus") return {abbr: "CurSt", full: "currentStatus"};
  if (k === "ecst" || k === "economicstructure") return {abbr: "EcSt", full: "economicStructure"};
  return null;
}

function normalizeCity(s: string) {
  return s
    .toLowerCase()
    .replace(/ı/g, "i").replace(/İ/g, "i")
    .replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function filterByCity(payload: any, cityname: string) {
  const want = normalizeCity(cityname);
  if (Array.isArray(payload)) {
    const filtered = payload.filter((row) => {
      const c = (row && (row.city ?? row.City ?? row.cityname ?? row.CityName ?? row.il ?? row.IL));
      return c && normalizeCity(String(c)) === want;
    });
    return filtered.length ? filtered : null;
  }
  if (payload && typeof payload === "object") {
    const singleCity = (payload.city ?? payload.City ?? payload.cityname ?? payload.CityName ?? payload.il ?? payload.IL);
    if (singleCity && normalizeCity(String(singleCity)) === want) return payload;
    const key = Object.keys(payload).find(k => normalizeCity(k) === want);
    if (key) return (payload as any)[key];
  }
  return null;
}

const ok = (body:string, type="application/json") => ({
  statusCode: 200,
  headers: { "Content-Type": type, "Cache-Control": "public, max-age=600" },
  body
});
const notFound = (msg:string)=>({ statusCode:404, body:msg });
const bad = (msg:string)=>({ statusCode:400, body:msg });

export const handler: Handler = async (event) => {
  try {
    const p = event.path.replace(/^.*\/datas\//,""); // after /datas/
    const seg = p.split("/").filter(Boolean);

    const cityParam =
      event.queryStringParameters?.cityname ||
      event.queryStringParameters?.city ||
      event.queryStringParameters?.il;

    if (seg[0] === "source") {
      const file = seg.slice(1).join("/") + ".json";
      const url = `/.netlify/functions/static?file=repo/source/${file}`;
      const r = await fetch(url);
      if (!r.ok) return notFound("source file not found");
      const fileText = await r.text();

      if (cityParam) {
        try {
          const obj = JSON.parse(fileText);
          const sliced = filterByCity(obj, cityParam);
          if (!sliced) return notFound(`city not found: ${cityParam}`);
          return ok(JSON.stringify(sliced));
        } catch {
          return ok(fileText);
        }
      }
      return ok(fileText);
    }

    if (seg[0] === "byMeta") {
      const [_, status, topic, digit, year, viz, measureOpt] = seg;
      const stat = mapStatus(status);
      if (!stat) return bad("invalid status");
      const measure = (measureOpt || "value").toLowerCase();

      const idx = await loadIndex();
      const candidates = idx.filter(it => {
        const m = it.meta || {};
        return m.status && (m.status.toLowerCase() === stat.abbr.toLowerCase()) &&
               m.topic && (m.topic.toLowerCase() === topic.toLowerCase()) &&
               m.digit && (m.digit.toLowerCase() === digit.toLowerCase()) &&
               m.year && (String(m.year) === String(year)) &&
               m.viz && (m.viz.toLowerCase() === viz.toLowerCase()) &&
               m.measure && (m.measure.toLowerCase() === measure);
      });

      const chosen = candidates.length ? candidates[0] : null;
      if (!chosen) return notFound("no match in index");

      const url = `/.netlify/functions/static?file=repo/source/${chosen.path}`;
      const r = await fetch(url);
      if (!r.ok) return notFound("file not found");
      const fileText = await r.text();

      if (cityParam) {
        try {
          const obj = JSON.parse(fileText);
          const sliced = filterByCity(obj, cityParam);
          if (!sliced) return notFound(`city not found: ${cityParam}`);
          return ok(JSON.stringify(sliced));
        } catch {
          return ok(fileText);
        }
      }
      return ok(fileText);
    }

    return bad("unknown path. Try /datas/source/... or /datas/byMeta/{status}/{topic}/{digit}/{year}/{viz}/{measure?}");
  } catch (e:any) {
    return { statusCode: 500, body: String(e) };
  }
};
