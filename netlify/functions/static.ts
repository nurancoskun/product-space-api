
import type { Handler } from "@netlify/functions";
import fs from "fs";
import path from "path";

export const handler: Handler = async (event) => {
  try {
    const file = event.queryStringParameters?.file || "";
    if (!file) {
      return { statusCode: 400, body: "missing file" };
    }

    // Yol güvenliği: path traversal engelle
    const safeRel = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, "");
    const abs = path.join(process.cwd(), "public", safeRel);

    // Dosya var mı?
    if (!fs.existsSync(abs)) {
      return { statusCode: 404, body: `not found: ${safeRel}` };
    }

    // İçerik tipi
    const ext = path.extname(abs).toLowerCase();
    const type =
      ext === ".json" ? "application/json" :
      ext === ".csv"  ? "text/csv; charset=utf-8" :
      ext === ".txt"  ? "text/plain; charset=utf-8" :
      ext === ".html" ? "text/html; charset=utf-8" :
      "application/octet-stream";

    // Metin dosyaları için UTF-8 oku
    if (type.startsWith("text/") || type === "application/json" || type === "text/html; charset=utf-8") {
      const text = fs.readFileSync(abs, "utf8");
      return { statusCode: 200, headers: { "Content-Type": type }, body: text };
    }

    // Binary dosyalar için base64
    const buf = fs.readFileSync(abs);
    return {
      statusCode: 200,
      headers: { "Content-Type": type },
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e: any) {
    return { statusCode: 500, body: String(e?.stack || e) };
  }
};

};
