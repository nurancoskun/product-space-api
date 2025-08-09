import type { Handler } from "@netlify/functions";
import fs from "fs";
import path from "path";

export const handler: Handler = async (event) => {
  try {
    const file = event.queryStringParameters?.file || "";
    if (!file) return { statusCode: 400, body: "missing file" };

    // Güvenli yol ve public altında çöz
    const safeRel = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, "");
    const abs = path.join(process.cwd(), "public", safeRel);

    if (!fs.existsSync(abs)) {
      return { statusCode: 404, body: `not found: ${safeRel}` };
    }

    const ext = path.extname(abs).toLowerCase();
    const type =
      ext === ".json" ? "application/json" :
      ext === ".csv"  ? "text/csv; charset=utf-8" :
      ext === ".txt"  ? "text/plain; charset=utf-8" :
      ext === ".html" ? "text/html; charset=utf-8" :
      "application/octet-stream";

    if (type.startsWith("text/") || type === "application/json" || type.includes("html")) {
      const text = fs.readFileSync(abs, "utf8");
      return { statusCode: 200, headers: { "Content-Type": type }, body: text };
    }

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
