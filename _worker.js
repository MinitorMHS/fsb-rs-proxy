/**
 * fsb-rs Cloudflare Worker proxy.
 *
 * Sits in front of your fsb-rs server and streams every request through
 * Cloudflare's edge, so the origin IP stays hidden and clients get CF's
 * network performance.
 *
 * Compatibility with fsb-rs links (including HASH_SECRET):
 *   - The path and the query string are forwarded VERBATIM — the short hash,
 *     `d=true`, and the signed `exp`/`sig` parameters reach the server byte
 *     for byte. The server verifies them; the worker holds no secrets.
 *   - `Range` requests pass through untouched, so seeking and resumable
 *     downloads behave exactly like a direct connection.
 *   - Response bodies are streamed, never buffered: file size is irrelevant
 *     to worker memory.
 *
 * Configuration (wrangler.toml [vars] or the dashboard):
 *   ORIGIN            Required. Where fsb-rs actually runs, e.g.
 *                     "https://fsb.example.com" (no trailing slash). The
 *                     server's HOST env must then be the worker's public URL
 *                     so generated links point through this worker.
 *   FORWARD_CLIENT_IP Optional, "true" by default. Sends the visitor's real
 *                     IP as X-Forwarded-For. Pair it with TRUST_PROXY_HEADERS
 *                     =true on the fsb-rs side so the per-IP rate limiter and
 *                     stream caps keep working (otherwise every client shares
 *                     a Cloudflare egress IP).
 *
 * Deploy: npx wrangler deploy   (or paste worker.js in the dashboard).
 */

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function stripHopByHop(headers) {
  const out = new Headers(headers);
  for (const name of [...out.keys()]) {
    if (HOP_BY_HOP.has(name) || name.startsWith("cf-") || name.startsWith("x-forwarded-")) {
      out.delete(name);
    }
  }
  return out;
}

export default {
  async fetch(request, env) {
    const origin = (env.ORIGIN || "").replace(/\/+$/, "");
    if (!origin) {
      return new Response("worker misconfigured: ORIGIN is not set\n", {
        status: 500,
        headers: { "content-type": "text/plain" },
      });
    }

    const url = new URL(request.url);
    // pathname + search are already encoded exactly as the client sent them;
    // do not touch either — the server checks the hash/signature over them.
    const target = origin + url.pathname + url.search;

    const headers = stripHopByHop(request.headers);
    if ((env.FORWARD_CLIENT_IP ?? "true") === "true") {
      const ip = request.headers.get("cf-connecting-ip");
      if (ip) headers.set("X-Forwarded-For", ip);
    }

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      // GET/HEAD must not carry a body; everything else streams through.
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual",
      // Signed URLs and Range responses must never be served from a cache.
      cache: "no-store",
    });

    const responseHeaders = new Headers(upstream.headers);
    for (const name of ["connection", "keep-alive", "transfer-encoding"]) {
      responseHeaders.delete(name);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};
