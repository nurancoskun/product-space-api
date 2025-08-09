import type { Handler } from "@netlify/functions";

type ManifestEntry = { file: string; root?: string; cityKeys?: string[] };
type Manifest = Record<string, ManifestEntry>;

const ok = (b: string, t = "application/json") => ({
  statusCode: 200,
  headers: { "Content-Type": t, "Cache-Control": "public, max-age=600" },
  body: b,
});
const nf = (m: string) => ({ statusCode: 404, body: m });
const bad = (m: string) => ({ statusCode: 400, body: m });

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();

const cityParam = (e: any) => {
  const p = e.queryStringParameters || {};
  const v = p.cityname || p.city || p.il;
  return typeof v === "string" ? v.trim() : "";
};

const isAll = (v?: string) => !!v && norm(v) === "all";

const at = (o: any, p?: string) =>
  !p ? o : p.split(".").reduce((a: any, k: string) => (a && typeof a === "object" ? a[k] : undefined), o);

function filterByCity(payload: any, c: string, keys?: string[]) {
  const want = norm(c);
  const K = keys && keys.length ? keys : ["il", "city", "cityname", "City", "CityName", "IL"];
  const hit = (row: any) => {
    for (const k of K) {
      if (row && row[k] && norm(String(row[k])) === want) return true;
    }
    return false;
  };
  if (Array.isArray(payload)) return payload.filter(hit);
  if (payload && typeof payload === "object") {
    if (hit(payload)) return payload;
    const key = Object.keys(payload).find((k) => norm(k) === want);
    if (key) return (payload as any)[key];
  }
  return null;
}

export const handler: Handler = async (event) => {
  try {
    const seg = event.path.replace(/^.*\/datas\//, "").split("/").filter(Boolean);

    // Absolute fetch to avoid Node relative URL issues
    // origin’i güvenli şekilde çıkar (Netlify’da en sağlam yöntem)
const origin = (() => {
  try { return new URL(event.rawUrl!).origin; } catch {}
  const proto = (event.headers["x-forwarded-proto"] as string) || "https";
  const host  = (event.headers["host"] as string) || "";
  return host ? `${proto}://${host}` : "http://127.0.0.1:8888";
})();

const getText = async (fileRel: string) => {
  const u = new URL(`/.netlify/functions/static?file=${encodeURIComponent(fileRel)}`, origin).toString();
  const r = await fetch(u);
  if (!r.ok) return null;
  return await r.text();
};


    // Passthrough mode
    if (seg[0] === "source") {
      const file = seg.slice(1).join("/") + ".json";
      const txt = await getText(`repo/source/${file}`);
      if (!txt) return nf("source file not found");
      const cp = cityParam(event);
      if (!cp || isAll(cp)) return ok(txt);
      try {
        const obj = JSON.parse(txt);
        const sliced = filterByCity(obj, cp);
        if (!sliced) return nf(`city not found: ${cp}`);
        return ok(JSON.stringify(sliced));
      } catch {
        return ok(txt);
      }
    }

    // v1 API
    if (seg[0] === "v1") {
      const [_, section, topic, digit, year, viz] = seg;

      const maniTxt = await getText(`repo/${section}/manifest.json`);
      if (!maniTxt) return nf(`manifest not found for ${section}`);
      let mani: Manifest;
      try {
        mani = JSON.parse(maniTxt) as Manifest;
      } catch {
        return bad("invalid manifest");
      }

      const cp = cityParam(event);
      const allCities = isAll(cp);
      const key = `${section}:${viz}:${topic}:${digit}:${year}`;

      // YEAR = ALL logic
      if (norm(year) === "all") {
        // First: check direct all file
        const directAllKey = `${section}:${viz}:${topic}:${digit}:all`;
        const directAllEntry = mani[directAllKey];
        if (directAllEntry?.file) {
          const txt = await getText(directAllEntry.file);
          if (!txt) return nf("file not found (year=all)");
          if (!cp || allCities) return ok(txt);
          try {
            const full = JSON.parse(txt);
            let data = at(full, directAllEntry.root);
            if (data === undefined) data = full;
            const sliced = filterByCity(data, cp, directAllEntry.cityKeys);
            if (!sliced) return nf(`city not found: ${cp}`);
            return ok(JSON.stringify(sliced));
          } catch {
            return ok(txt);
          }
        }

        // Aggregate years if direct all not found
        const prefix = `${section}:${viz}:${topic}:${digit}:`;
        const entries = Object.entries(mani)
          .filter(([k]) => k.startsWith(prefix) && !k.endsWith(":all"))
          .map(([k, v]) => ({ year: k.slice(prefix.length), entry: v as ManifestEntry }))
          .sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));

        if (!entries.length) return nf("no years matched in manifest");

        const chunks: Array<{ year: string; data: any }> = [];
        for (const e of entries) {
          const txt = await getText(e.entry.file);
          if (!txt) continue;
          try {
            const full = JSON.parse(txt);
            let data = at(full, e.entry.root);
            if (data === undefined) data = full;
            if (cp && !allCities) {
              const sliced = filterByCity(data, cp, e.entry.cityKeys);
              if (!sliced) continue;
              data = sliced;
            }
            chunks.push({ year: e.year, data });
          } catch {}
        }

        if (!chunks.length) return nf("no data matched for year=all");

        const allArr = chunks.every((c) => Array.isArray(c.data));
        const allObj = chunks.every((c) => c.data && typeof c.data === "object" && !Array.isArray(c.data));

        if (allArr) {
          const out: any[] = [];
          for (const c of chunks) {
            for (const r of c.data as any[]) {
              out.push(r && typeof r === "object" && !("year" in r) ? { ...r, year: c.year } : r);
            }
          }
          return ok(JSON.stringify(out));
        }

        if (allObj) {
          const out: Record<string, any> = {};
          for (const c of chunks) {
            for (const k of Object.keys(c.data)) {
              if (!out[k]) out[k] = c.data[k];
              else out[`${k}_${c.year}`] = c.data[k];
            }
          }
          return ok(JSON.stringify(out));
        }

        return ok(JSON.stringify(chunks.map((c) => ({ year: c.year, value: c.data }))));
      }

      // Single year
      const entry = mani[key];
      if (!entry?.file) return nf(`manifest miss: ${key}`);
      const txt = await getText(entry.file);
      if (!txt) return nf("file not found");
      if (!cp || allCities) return ok(txt);
      try {
        const full = JSON.parse(txt);
        let data = at(full, entry.root);
        if (data === undefined) data = full;
        const sliced = filterByCity(data, cp, entry.cityKeys);
        if (!sliced) return nf(`city not found: ${cp}`);
        return ok(JSON.stringify(sliced));
      } catch {
        return ok(txt);
      }
    }

    return bad("unknown path. Try /datas/source/... or /datas/v1/:section/:topic/:digit/:year/:viz");
  } catch (e: any) {
    return { statusCode: 500, body: String(e) };
  }
};
