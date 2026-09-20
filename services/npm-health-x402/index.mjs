import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { declareDiscoveryExtension } from '@x402/extensions/bazaar';

const PAY_TO = '0xf200174de10c26ce7670aaf41d69a8979fe5629d';
const NETWORK = 'eip155:8453';
const FACILITATOR = 'https://facilitator.openx402.ai';
const PRICE = '$0.01';

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR });
const resourceServer = new x402ResourceServer(facilitator).register(
  NETWORK,
  new ExactEvmScheme(),
);

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'PAYMENT-REQUIRED,PAYMENT-RESPONSE,X-PAYMENT-REQUIRED,X-PAYMENT-RESPONSE',
  );
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const serviceManifest = {
  spec: 'agent402-service-manifest/1',
  version: 1,
  name: 'Ops Control HQ NPM Health',
  resources: ['/api/npm-health?package=react'],
  pricing: { currency: 'USDC', amount: '0.01', unit: 'request' },
  network: NETWORK,
  payTo: PAY_TO,
};

app.get('/.well-known/x402', (req, res) => res.json(serviceManifest));
app.get('/api/.well-known/x402', (req, res) => res.json(serviceManifest));

app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'npm-health-x402', priceUsd: 0.01, network: NETWORK }),
);

app.get('/api/openapi.json', (req, res) =>
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'Ops Control HQ NPM Health x402 API',
      version: '1.0.0',
      description: 'Current npm package health snapshots paid per request with x402 Base USDC.',
      contact: { email: 'opscontrolhq@outlook.com' },
    },
    paths: {
      '/api/npm-health': {
        get: {
          operationId: 'getNpmPackageHealth',
          summary: 'Get a current npm package health snapshot',
          parameters: [
            {
              name: 'package',
              in: 'query',
              required: true,
              schema: { type: 'string', minLength: 1, maxLength: 214 },
              example: 'react',
            },
          ],
          responses: {
            '200': { description: 'Package health snapshot' },
            '402': { description: 'Payment Required' },
          },
        },
      },
    },
  }),
);

app.use(
  paymentMiddleware(
    {
      'GET /api/npm-health': {
        accepts: {
          scheme: 'exact',
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
        },
        description: 'Current npm package health and dependency-risk snapshot',
        mimeType: 'application/json',
        serviceName: 'Ops Control HQ NPM Health',
        tags: ['npm', 'package-health', 'dependency-risk', 'developer-tools'],
        extensions: {
          ...declareDiscoveryExtension({
            input: { package: 'react' },
            inputSchema: {
              properties: {
                package: {
                  type: 'string',
                  description: 'npm package name, including scoped packages',
                },
              },
              required: ['package'],
            },
            output: {
              example: {
                package: 'react',
                latestVersion: '19.3.0',
                weeklyDownloads: 100000000,
                maintainers: 2,
                dependencies: 0,
                devDependencies: 0,
                license: 'MIT',
                deprecated: false,
                riskScore: 0,
                flags: [],
              },
            },
          }),
        },
      },
    },
    resourceServer,
  ),
);

function licenseText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.type === 'string') return value.type;
  return 'unknown';
}

async function snapshot(pkg) {
  const normalized = String(pkg || '').trim();
  if (!normalized || normalized.length > 214 || !/^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(normalized)) {
    return { error: 'invalid_package' };
  }

  const encoded = encodeURIComponent(normalized);
  const [metaResponse, downloadsResponse] = await Promise.all([
    fetch(`https://registry.npmjs.org/${encoded}`, { headers: { accept: 'application/json' } }),
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encoded}`, { headers: { accept: 'application/json' } }),
  ]);

  if (!metaResponse.ok) {
    return { error: metaResponse.status === 404 ? 'package_not_found' : 'npm_registry_error' };
  }

  const meta = await metaResponse.json();
  const downloads = downloadsResponse.ok ? await downloadsResponse.json() : {};
  const latestVersion = meta['dist-tags']?.latest || '';
  const current = latestVersion ? meta.versions?.[latestVersion] : undefined;
  const publishedAt = latestVersion ? meta.time?.[latestVersion] : undefined;
  const publishedMs = publishedAt ? Date.parse(publishedAt) : NaN;
  const daysSincePublish = Number.isFinite(publishedMs)
    ? Math.max(0, Math.floor((Date.now() - publishedMs) / 86400000))
    : null;
  const maintainers = Array.isArray(meta.maintainers) ? meta.maintainers.length : 0;
  const dependencies = Object.keys(current?.dependencies || {}).length;
  const devDependencies = Object.keys(current?.devDependencies || {}).length;
  const weeklyDownloads = typeof downloads.downloads === 'number' ? downloads.downloads : 0;
  const deprecated = Boolean(current?.deprecated);

  const flags = [];
  let riskScore = 0;
  if (deprecated) { flags.push('deprecated'); riskScore += 45; }
  if (maintainers === 0) { flags.push('no_listed_maintainers'); riskScore += 20; }
  if (daysSincePublish !== null && daysSincePublish > 730) { flags.push('stale_over_2y'); riskScore += 25; }
  else if (daysSincePublish !== null && daysSincePublish > 365) { flags.push('stale_over_1y'); riskScore += 12; }
  if (weeklyDownloads < 100) { flags.push('low_weekly_downloads'); riskScore += 10; }
  if (!latestVersion) { flags.push('missing_latest_tag'); riskScore += 20; }

  return {
    package: meta.name || normalized,
    latestVersion,
    publishedAt: publishedAt || null,
    daysSincePublish,
    weeklyDownloads,
    maintainers,
    dependencies,
    devDependencies,
    license: licenseText(current?.license ?? meta.license),
    deprecated,
    deprecationMessage: current?.deprecated || null,
    repository: current?.repository || null,
    homepage: current?.homepage || null,
    riskScore: Math.min(100, riskScore),
    flags,
    methodology: 'Deterministic heuristic from public npm registry metadata and weekly download counts. Not a security audit.',
    checkedAt: new Date().toISOString(),
  };
}

app.get('/api/sample', async (req, res) => {
  if ((req.query.package || 'react') !== 'react') return res.status(400).json({ error: 'free_sample_is_react_only' });
  const result = await snapshot('react');
  if (result.error) return res.status(result.error === 'package_not_found' ? 404 : 502).json(result);
  res.json(result);
});

app.get('/api/npm-health', async (req, res) => {
  const result = await snapshot(req.query.package || '');
  if (result.error) {
    const status = result.error === 'invalid_package' ? 400 : result.error === 'package_not_found' ? 404 : 502;
    return res.status(status).json(result);
  }
  res.json(result);
});

app.get('/', (req, res) =>
  res.json({
    service: 'Ops Control HQ NPM Health x402 API',
    price: PRICE,
    network: NETWORK,
    paidRoute: '/api/npm-health?package=react',
    health: '/health',
    sample: '/api/sample?package=react',
    openapi: '/api/openapi.json',
  }),
);

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  console.log(`npm-health-x402 listening on :${port}`);
});
