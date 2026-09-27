import { HTTPFacilitatorClient, x402ResourceServer } from 'npm:@x402/core@2.26.0/server';
import { ExactEvmScheme } from 'npm:@x402/evm@2.26.0/exact/server';

const PAY_TO = '0xf200174de10c26ce7670aaf41d69a8979fe5629d' as `0x${string}`;
const NETWORK = 'eip155:8453';
const PRICE = '$0.01';
const FACILITATOR = 'https://facilitator.payai.network';
const PUBLIC_BASE = 'https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/base-vuln-intel';
const PAID_URL = `${PUBLIC_BASE}/v1/vulnerability-intel`;
const SOURCE_URL = 'https://github.com/Jay44333/startup-credits/blob/ops-control-nano-seller/ops-control-base-vuln/index.ts';
const OSV_BATCH = 'https://api.osv.dev/v1/querybatch';
const MAX_QUERIES = 20;
const MAX_BODY_BYTES = 64000;

type Query = { ecosystem?: string; name?: string; version?: string; purl?: string };
type Input = { queries: Query[] };
const SAMPLE: Input = { queries: [{ ecosystem: 'npm', name: 'lodash', version: '4.17.20' }, { ecosystem: 'PyPI', name: 'jinja2', version: '2.4.1' }] };

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR });
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());
const initialization = resourceServer.initialize();

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}
function cleanString(v: unknown, max = 300): string | undefined {
  if (typeof v !== 'string') return undefined;
  const x = v.trim();
  return x && x.length <= max ? x : undefined;
}
function validate(value: unknown): { ok: true; value: Input } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'body_must_be_object' };
  const raw = (value as { queries?: unknown }).queries;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_QUERIES) return { ok: false, error: `queries_must_have_1_to_${MAX_QUERIES}_items` };
  const queries: Query[] = [];
  for (let i = 0; i < raw.length; i++) {
    const q = raw[i];
    if (!q || typeof q !== 'object' || Array.isArray(q)) return { ok: false, error: `query_${i}_must_be_object` };
    const r = q as Record<string, unknown>;
    const purl = cleanString(r.purl, 500);
    const ecosystem = cleanString(r.ecosystem, 100);
    const name = cleanString(r.name, 300);
    const version = cleanString(r.version, 200);
    if (purl) queries.push({ purl });
    else if (ecosystem && name && version) queries.push({ ecosystem, name, version });
    else return { ok: false, error: `query_${i}_requires_ecosystem_name_version_or_versioned_purl` };
  }
  return { ok: true, value: { queries } };
}
function toOsv(input: Input) {
  return { queries: input.queries.map(q => q.purl ? { package: { purl: q.purl } } : { version: q.version, package: { ecosystem: q.ecosystem, name: q.name } }) };
}
async function lookup(input: Input) {
  const response = await fetch(OSV_BATCH, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(toOsv(input)) });
  const text = await response.text();
  if (!response.ok) return { ok: false as const, status: response.status, error: 'osv_upstream_error', detail: text.slice(0, 1000) };
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { return { ok: false as const, status: 502, error: 'osv_invalid_json' }; }
  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const normalized = input.queries.map((query, i) => {
    const row = results[i] || {};
    const vulns = Array.isArray(row.vulns) ? row.vulns.map((v: any) => ({ id: String(v?.id || ''), modified: v?.modified || null })).filter((v: any) => v.id) : [];
    return { query, vulnerabilityCount: vulns.length, vulnerabilities: vulns, nextPageToken: row.next_page_token || null, truncated: Boolean(row.next_page_token) };
  });
  const unique = [...new Set(normalized.flatMap(r => r.vulnerabilities.map(v => v.id)))].sort();
  return { ok: true as const, report: { results: normalized, summary: { queries: input.queries.length, totalMatches: normalized.reduce((n, r) => n + r.vulnerabilityCount, 0), uniqueVulnerabilities: unique.length, uniqueVulnerabilityIds: unique, truncatedQueries: normalized.filter(r => r.truncated).length }, source: 'OSV.dev /v1/querybatch', sourceDocs: 'https://google.github.io/osv.dev/post-v1-querybatch/', methodology: 'Known-vulnerability ID lookup for exact package versions or versioned purls. OSV batch results return vulnerability IDs and modified timestamps; this is not a security audit.', checkedAt: new Date().toISOString() } };
}

const inputSchema = {
  type: 'object', required: ['queries'], additionalProperties: false,
  properties: { queries: { type: 'array', minItems: 1, maxItems: MAX_QUERIES, items: { type: 'object', additionalProperties: false, properties: { ecosystem: { type: 'string' }, name: { type: 'string' }, version: { type: 'string' }, purl: { type: 'string' } } } } }
};
const openApi = {
  openapi: '3.1.0',
  info: { title: 'Ops Control HQ OSV Vulnerability Intelligence x402 API', version: '2026.09.27.1', description: 'Batch exact-version vulnerability ID lookup backed by OSV.dev. Up to 20 package/version or versioned-purl queries per $0.01 call.', contact: { email: 'opscontrolhq@outlook.com' } },
  servers: [{ url: PUBLIC_BASE }],
  'x-discovery': { ownershipProofs: [PAY_TO], source: SOURCE_URL },
  paths: {
    '/v1/vulnerability-intel': {
      post: {
        operationId: 'getBatchVulnerabilityIntel', summary: 'Check up to 20 exact package versions against OSV', tags: ['Security', 'Developer tooling'],
        requestBody: { required: true, content: { 'application/json': { schema: inputSchema, example: SAMPLE } } },
        'x-payment-info': { protocols: [{ x402: {} }], price: { mode: 'fixed', currency: 'USD', amount: '0.01' }, network: NETWORK, asset: 'USDC', payTo: PAY_TO },
        responses: { '200': { description: 'Paid OSV vulnerability lookup' }, '400': { description: 'Invalid input' }, '402': { description: 'Payment Required' }, '502': { description: 'OSV upstream failure' } }
      }
    }
  }
};
const wellKnown = { version: 1, resources: [PAID_URL], ownershipProofs: [PAY_TO], instructions: 'POST JSON with 1-20 exact package/version queries or versioned purls. Runtime 402 is authoritative.', openapi: `${PUBLIC_BASE}/openapi.json`, source: SOURCE_URL };

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const suffix = u.pathname.replace(/^\/base-vuln-intel/, '');
  if (req.method === 'GET' && (suffix === '/' || suffix === '' || suffix === '/healthz')) {
    await initialization;
    return json({ ok: true, service: 'osv-vulnerability-intel-x402', version: '2026.09.27.1', priceUsd: 0.01, maxQueries: MAX_QUERIES, network: NETWORK, payTo: PAY_TO, upstream: 'OSV.dev', discovery: { openapi: `${PUBLIC_BASE}/openapi.json`, x402: `${PUBLIC_BASE}/.well-known/x402`, source: SOURCE_URL } });
  }
  if (req.method === 'GET' && suffix === '/openapi.json') return json(openApi);
  if (req.method === 'GET' && suffix === '/.well-known/x402') return json(wellKnown);
  if (req.method === 'GET' && suffix === '/llms.txt') return new Response(`Ops Control HQ OSV Vulnerability Intelligence x402 API\nPaid: POST ${PAID_URL}\nPrice: $0.01 USDC on Base (eip155:8453), x402 v2 exact\nMax: ${MAX_QUERIES} queries\nOpenAPI: ${PUBLIC_BASE}/openapi.json\nDiscovery: ${PUBLIC_BASE}/.well-known/x402\nFree sample: ${PUBLIC_BASE}/sample\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (req.method === 'GET' && suffix === '/sample') {
    const result = await lookup({ queries: [{ ecosystem: 'npm', name: 'lodash', version: '4.17.20' }] });
    return result.ok ? json(result.report) : json(result, 502);
  }
  if (req.method === 'GET' && suffix === '/self-check') {
    const response = await fetch(PAID_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(SAMPLE) });
    const header = response.headers.get('PAYMENT-REQUIRED');
    let decoded: unknown = null;
    if (header) { try { decoded = JSON.parse(atob(header)); } catch { decoded = 'decode_failed'; } }
    const report = { target: PAID_URL, status: response.status, paymentRequiredPresent: Boolean(header), paymentRequiredDecoded: decoded, body: await response.text() };
    console.log(`VULN_X402_SELF_CHECK ${JSON.stringify(report)}`);
    return json(report);
  }
  if (req.method !== 'POST' || suffix !== '/v1/vulnerability-intel') return json({ error: 'not_found' }, 404);
  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'body_too_large' }, 413);
  let parsed: unknown;
  try { parsed = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const check = validate(parsed);
  if (!check.ok) return json({ error: check.error }, 400);

  await initialization;
  const config = { scheme: 'exact', network: NETWORK, price: PRICE, payTo: PAY_TO, description: 'Batch exact-version vulnerability ID lookup backed by OSV.dev, up to 20 queries', mimeType: 'application/json' };
  const requirements = (await resourceServer.buildPaymentRequirements(config))[0];
  const paymentHeader = req.headers.get('PAYMENT-SIGNATURE') || req.headers.get('X-PAYMENT');
  if (!paymentHeader) {
    const paymentRequired = await resourceServer.createPaymentRequiredResponse([requirements], { url: PAID_URL, description: config.description, mimeType: config.mimeType });
    return json({ error: 'payment_required', x402Version: 2, network: NETWORK, price: PRICE }, 402, { 'PAYMENT-REQUIRED': btoa(JSON.stringify(paymentRequired)) });
  }
  try {
    const payload = JSON.parse(atob(paymentHeader));
    const verified = await resourceServer.verifyPayment(payload, requirements);
    if (!verified.isValid) return json({ error: 'invalid_payment', reason: verified.invalidReason }, 402);
    const result = await lookup(check.value);
    if (!result.ok) return json({ error: result.error, upstreamStatus: result.status, detail: 'detail' in result ? result.detail : undefined }, 502);
    const settled = await resourceServer.settlePayment(payload, requirements);
    if (!settled.success) return json({ error: 'settlement_failed', reason: settled.errorReason }, 402);
    console.log(`VULN_X402_SETTLED ${JSON.stringify({ queryCount: check.value.queries.length, transaction: settled.transaction ?? null, at: new Date().toISOString() })}`);
    return json({ ...result.report, payment: settled.transaction ?? null }, 200, { 'PAYMENT-RESPONSE': btoa(JSON.stringify(settled)) });
  } catch (error) {
    return json({ error: 'request_failed', message: error instanceof Error ? error.message : String(error) }, 400);
  }
});
