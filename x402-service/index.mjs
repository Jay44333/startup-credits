import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

const PAY_TO = '0xf200174de10c26ce7670aaf41d69a8979fe5629d';
const NETWORK = 'eip155:8453';
const FACILITATOR = 'https://facilitator.openx402.ai';
const PORT = Number(process.env.PORT || 3000);

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR });
const resourceServer = new x402ResourceServer(facilitator).register(
  NETWORK,
  new ExactEvmScheme()
);

const app = new Hono();

app.get('/health', c => c.json({
  ok: true,
  service: 'opscontrol-npm-health-x402',
  priceUsd: 0.01,
  network: NETWORK
}));

app.get('/.well-known/x402', c => {
  const resource = new URL('/api/npm-health?package=react', c.req.url).toString();
  return c.json({
    spec: 'agent402-service-manifest/1',
    version: 1,
    resources: [resource]
  });
});

app.get('/api/openapi.json', c => {
  const base = new URL(c.req.url).origin;
  return c.json({
    openapi: '3.1.0',
    info: {
      title: 'Ops Control HQ NPM Health x402 API',
      version: '1.0.0',
      description: 'Deterministic npm package-health snapshots paid per request with x402 Base USDC.',
      contact: { email: 'opscontrolhq@outlook.com' }
    },
    servers: [{ url: base }],
    paths: {
      '/api/npm-health': {
        get: {
          operationId: 'getNpmPackageHealth',
          summary: 'Get a current npm package-health snapshot',
          parameters: [{
            name: 'package',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 214 },
            example: 'react'
          }],
          'x-payment-info': {
            price: { mode: 'fixed', currency: 'USD', amount: '0.010000' },
            protocols: [{ x402: {} }]
          },
          responses: {
            '200': { description: 'Package-health snapshot' },
            '402': { description: 'Payment Required' }
          }
        }
      }
    }
  });
});

app.get('/api/sample', async c => {
  const result = await snapshot('react');
  if ('error' in result) return c.json(result, 502);
  return c.json(result);
});

app.use(
  '/api/npm-health',
  paymentMiddleware(
    {
      'GET /api/npm-health': {
        accepts: [{
          scheme: 'exact',
          price: '$0.01',
          network: NETWORK,
          payTo: PAY_TO
        }],
        description: 'Current npm package health and dependency-risk snapshot',
        mimeType: 'application/json'
      }
    },
    resourceServer
  )
);

app.get('/api/npm-health', async c => {
  const pkg = (c.req.query('package') || '').trim();
  if (!pkg || pkg.length > 214 || !/^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(pkg)) {
    return c.json({ error: 'invalid_package' }, 400);
  }
  const result = await snapshot(pkg);
  if ('error' in result) {
    return c.json(result, result.error === 'package_not_found' ? 404 : 502);
  }
  return c.json(result);
});

async function snapshot(pkg) {
  const encoded = encodeURIComponent(pkg);
  const [metaResponse, downloadsResponse] = await Promise.all([
    fetch(`https://registry.npmjs.org/${encoded}`, { headers: { accept: 'application/json' } }),
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encoded}`, { headers: { accept: 'application/json' } })
  ]);

  if (!metaResponse.ok) {
    return { error: metaResponse.status === 404 ? 'package_not_found' : 'npm_registry_error' };
  }

  const meta = await metaResponse.json();
  const downloads = downloadsResponse.ok ? await downloadsResponse.json() : {};
  const latestVersion = meta?.['dist-tags']?.latest || '';
  const current = latestVersion ? meta?.versions?.[latestVersion] : undefined;
  const publishedAt = latestVersion ? meta?.time?.[latestVersion] : undefined;
  const publishedMs = publishedAt ? Date.parse(publishedAt) : NaN;
  const daysSincePublish = Number.isFinite(publishedMs)
    ? Math.max(0, Math.floor((Date.now() - publishedMs) / 86400000))
    : null;
  const maintainers = Array.isArray(meta?.maintainers) ? meta.maintainers.length : 0;
  const weeklyDownloads = typeof downloads?.downloads === 'number' ? downloads.downloads : 0;
  const deprecated = Boolean(current?.deprecated);
  const flags = [];
  let riskScore = 0;

  if (deprecated) { flags.push('deprecated'); riskScore += 45; }
  if (maintainers === 0) { flags.push('no_listed_maintainers'); riskScore += 20; }
  if (daysSincePublish !== null && daysSincePublish > 730) {
    flags.push('stale_over_2y'); riskScore += 25;
  } else if (daysSincePublish !== null && daysSincePublish > 365) {
    flags.push('stale_over_1y'); riskScore += 12;
  }
  if (weeklyDownloads < 100) { flags.push('low_weekly_downloads'); riskScore += 10; }
  if (!latestVersion) { flags.push('missing_latest_tag'); riskScore += 20; }

  const rawLicense = current?.license ?? meta?.license;
  const license = typeof rawLicense === 'string'
    ? rawLicense
    : rawLicense && typeof rawLicense === 'object' && typeof rawLicense.type === 'string'
      ? rawLicense.type
      : 'unknown';

  return {
    package: meta?.name || pkg,
    latestVersion,
    publishedAt: publishedAt || null,
    daysSincePublish,
    weeklyDownloads,
    maintainers,
    dependencies: Object.keys(current?.dependencies || {}).length,
    devDependencies: Object.keys(current?.devDependencies || {}).length,
    license,
    deprecated,
    riskScore: Math.min(100, riskScore),
    flags,
    methodology: 'Deterministic heuristic from public npm registry metadata and npm weekly download counts. Not a security audit.',
    checkedAt: new Date().toISOString()
  };
}

serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' });
