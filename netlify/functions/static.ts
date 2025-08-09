
import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  const file = event.queryStringParameters?.file;
  if (!file) {
    return { statusCode: 400, body: "missing file" };
  }
  try {
    const r = await fetch(new URL(`../../public/${file}`, import.meta.url));
    if (!r.ok) {
      return { statusCode: 404, body: "not found" };
    }
    return {
      statusCode: 200,
      headers: {
        "Content-Type": r.headers.get("content-type") || "application/json"
      },
      body: await r.text()
    };
  } catch (e: any) {
    return { statusCode: 500, body: String(e) };
  }
};
