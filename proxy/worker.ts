/**
 * Cloudflare Worker — Yahoo Finance CORS proxy
 *
 * Deploy:
 *   npm create cloudflare@latest invester-yahoo-proxy
 *   (or wrangler deploy from this file)
 *
 * Usage: GET https://your-worker.workers.dev/?symbol=AAPL
 */

const YAHOO_CHART = "https://query2.finance.yahoo.com/v8/finance/chart";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");
    if (!symbol) {
      return json({ error: "Missing ?symbol= query parameter" }, 400);
    }

    const yahooUrl = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=10y`;
    const yahooRes = await fetch(yahooUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; invester-dashboard/1.0; +https://github.com/colorage/investor-dashboard-site)",
      },
    });

    if (!yahooRes.ok) {
      return json(
        { error: `Yahoo HTTP ${yahooRes.status}`, symbol },
        yahooRes.status,
      );
    }

    const body = await yahooRes.text();
    return new Response(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  },
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}
