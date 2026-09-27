import { HTTPFacilitatorClient, x402ResourceServer } from 'npm:@x402/core@2.26.0/server';
import { ExactEvmScheme } from 'npm:@x402/evm@2.26.0/exact/server';

const PAY_TO = '0xf200174de10c26ce7670aaf41d69a8979fe5629d' as `0x${string}`;
const NETWORK = 'eip155:8453';
const PRICE = '$0.01';
const FACILITATOR = 'https://facilitator.payai.network';
const PUBLIC_BASE = 'https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/base-npm-health';
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR });
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());
const initialization = resourceServer.initialize();

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}

function licenseText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'type' in value && typeof (value as {type?:unknown}).type === 'string') return (value as {type:string}).type;
  return 'unknown';
}

async function snapshot(pkg: string) {
  const normalized = pkg.trim();
  if (!normalized || normalized.length > 214 || !/^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(normalized)) return { error: 'invalid_package' } as const;
  const encoded = encodeURIComponent(normalized);
  const [metaResponse, downloadsResponse] = await Promise.all([
    fetch(`https://registry.npmjs.org/${encoded}`, { headers: { accept: 'application/json' } }),
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encoded}`, { headers: { accept: 'application/json' } }),
  ]);
  if (!metaResponse.ok) return { error: metaResponse.status === 404 ? 'package_not_found' : 'npm_registry_error' } as const;
  const meta = await metaResponse.json();
  const downloads = downloadsResponse.ok ? await downloadsResponse.json() : {};
  const latestVersion = meta['dist-tags']?.latest || '';
  const current = latestVersion ? meta.versions?.[latestVersion] : undefined;
  const publishedAt = latestVersion ? meta.time?.[latestVersion] : undefined;
  const publishedMs = publishedAt ? Date.parse(publishedAt) : NaN;
  const daysSincePublish = Number.isFinite(publishedMs) ? Math.max(0, Math.floor((Date.now() - publishedMs) / 86400000)) : null;
  const maintainers = Array.isArray(meta.maintainers) ? meta.maintainers.length : 0;
  const dependencyCount = Object.keys(current?.dependencies || {}).length;
  const devDependencyCount = Object.keys(current?.devDependencies || {}).length;
  const weeklyDownloads = typeof downloads.downloads === 'number' ? downloads.downloads : 0;
  const deprecated = Boolean(current?.deprecated);
  const flags: string[] = [];
  let riskScore = 0;
  if (deprecated) { flags.push('deprecated'); riskScore += 45; }
  if (maintainers === 0) { flags.push('no_listed_maintainers'); riskScore += 20; }
  if (daysSincePublish !== null && daysSincePublish > 730) { flags.push('stale_over_2y'); riskScore += 25; }
  else if (daysSincePublish !== null && daysSincePublish > 365) { flags.push('stale_over_1y'); riskScore += 12; }
  if (weeklyDownloads < 100) { flags.push('low_weekly_downloads'); riskScore += 10; }
  if (!latestVersion) { flags.push('missing_latest_tag'); riskScore += 20; }
  riskScore = Math.min(100, riskScore);
  return {
    package: meta.name || normalized,
    latestVersion,
    publishedAt: publishedAt || null,
    daysSincePublish,
    weeklyDownloads,
    maintainers,
    dependencies: dependencyCount,
    devDependencies: devDependencyCount,
    license: licenseText(current?.license ?? meta.license),
    deprecated,
    deprecationMessage: current?.deprecated || null,
    repository: current?.repository || null,
    homepage: current?.homepage || null,
    riskScore,
    flags,
    methodology: 'Deterministic heuristic from public npm registry metadata and npm weekly download counts. Not a security audit.',
    checkedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  const internalUrl = new URL(req.url);
  const suffix = internalUrl.pathname.replace(/^\/base-npm-health/, '');

  if (req.method === 'GET' && (suffix === '/' || suffix === '' || suffix === '/healthz')) {
    await initialization;
    return json({ ok: true, service: 'npm-health-x402-base', priceUsd: 0.01, network: NETWORK, payTo: PAY_TO, facilitator: FACILITATOR });
  }

  if (req.method === 'GET' && suffix === '/sample') {
    const result = await snapshot('react');
    if ('error' in result) return json(result, 502);
    return json(result);
  }

  if (req.method === 'GET' && suffix === '/self-check') {
    const target = `${PUBLIC_BASE}/v1/npm-health?package=react`;
    const response = await fetch(target, { headers: { accept: 'application/json' } });
    const header = response.headers.get('PAYMENT-REQUIRED');
    let decoded: unknown = null;
    if (header) { try { decoded = JSON.parse(atob(header)); } catch { decoded = 'decode_failed'; } }
    const report = { target, status: response.status, paymentRequiredPresent: Boolean(header), paymentRequiredDecoded: decoded, body: await response.text() };
    console.log(`BASE_X402_SELF_CHECK ${JSON.stringify(report)}`);
    return json(report);
  }

  if (req.method !== 'GET' || suffix !== '/v1/npm-health') return json({ error: 'not_found' }, 404);

  await initialization;
  const publicResourceUrl = `${PUBLIC_BASE}/v1/npm-health${internalUrl.search}`;
  const config = {
    scheme: 'exact',
    network: NETWORK,
    price: PRICE,
    payTo: PAY_TO,
    description: 'Current npm package health and dependency-risk snapshot',
    mimeType: 'application/json',
  };
  const requirements = (await resourceServer.buildPaymentRequirements(config))[0];
  const paymentHeader = req.headers.get('PAYMENT-SIGNATURE') || req.headers.get('X-PAYMENT');

  if (!paymentHeader) {
    const paymentRequired = await resourceServer.createPaymentRequiredResponse([requirements], {
      url: publicResourceUrl,
      description: config.description,
      mimeType: config.mimeType,
    });
    return json({ error: 'payment_required', x402Version: 2, network: NETWORK, price: PRICE }, 402, { 'PAYMENT-REQUIRED': btoa(JSON.stringify(paymentRequired)) });
  }

  try {
    const payload = JSON.parse(atob(paymentHeader));
    const verified = await resourceServer.verifyPayment(payload, requirements);
    if (!verified.isValid) return json({ error: 'invalid_payment', reason: verified.invalidReason }, 402);
    const settled = await resourceServer.settlePayment(payload, requirements);
    if (!settled.success) return json({ error: 'settlement_failed', reason: settled.errorReason }, 402);
    const result = await snapshot(internalUrl.searchParams.get('package') || '');
    if ('error' in result) return json(result, result.error === 'invalid_package' ? 400 : result.error === 'package_not_found' ? 404 : 502);
    return json({ ...result, payment: settled.transaction ?? null }, 200, { 'PAYMENT-RESPONSE': btoa(JSON.stringify(settled)) });
  } catch (error) {
    return json({ error: 'request_failed', message: error instanceof Error ? error.message : String(error) }, 400);
  }
});
