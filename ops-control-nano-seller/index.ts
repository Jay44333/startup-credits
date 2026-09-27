import { HTTPFacilitatorClient, x402ResourceServer } from "npm:@x402/core@2.27.0/server";
import { ExactNanoScheme } from "npm:@x402nano/exact@0.2.3/server";

const PRICE = "0.001";
const FACILITATOR_URL = "https://facilitator.pursekeeper.dev";
const PAY_TO = "nano_3mr761i87o7o33hmrd67a1emt81j6djgdqeyod95ip5qcidz77b71x4ukqea";
const PUBLIC_BASE = "https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/nano-npm-risk";

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("nano:mainnet", new ExactNanoScheme());
const initialization = resourceServer.initialize();

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function validatePackageName(value: string | null) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 214 || /\s/.test(name)) return null;
  if (name.startsWith("@")) return /^@[a-z0-9][a-z0-9._~-]*\/[a-z0-9][a-z0-9._~-]*$/i.test(name) ? name : null;
  return /^[a-z0-9][a-z0-9._~-]*$/i.test(name) ? name : null;
}

function daysSince(iso: string | null, now: Date) {
  if (!iso) return null;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

function repositoryUrl(repository: unknown): string | null {
  if (!repository) return null;
  if (typeof repository === "string") return repository;
  if (typeof repository === "object" && repository !== null && "url" in repository) {
    const value = (repository as { url?: unknown }).url;
    return typeof value === "string" ? value : null;
  }
  return null;
}

async function buildNpmRiskReport(packageName: string | null) {
  const normalized = validatePackageName(packageName);
  if (!normalized) throw Object.assign(new Error("Invalid npm package name"), { statusCode: 400 });
  const encoded = encodeURIComponent(normalized);
  const [metadataResponse, downloadsResponse] = await Promise.all([
    fetch(`https://registry.npmjs.org/${encoded}`, { headers: { accept: "application/json" } }),
    fetch(`https://api.npmjs.org/downloads/point/last-week/${encoded}`, { headers: { accept: "application/json" } }),
  ]);
  if (metadataResponse.status === 404) throw Object.assign(new Error("Package not found"), { statusCode: 404 });
  if (!metadataResponse.ok) throw Object.assign(new Error(`npm registry returned ${metadataResponse.status}`), { statusCode: 502 });
  const metadata = await metadataResponse.json();
  const latestVersion = metadata["dist-tags"]?.latest ?? null;
  const latest = latestVersion ? metadata.versions?.[latestVersion] ?? {} : {};
  const lastPublishedAt = latestVersion ? metadata.time?.[latestVersion] ?? null : null;
  const lastPublishedDaysAgo = daysSince(lastPublishedAt, new Date());
  const maintainers = Array.isArray(metadata.maintainers) ? metadata.maintainers.length : 0;
  const weeklyDownloads = downloadsResponse.ok ? Number((await downloadsResponse.json()).downloads ?? 0) : null;
  const flags: Record<string, unknown>[] = [];
  if (latest.deprecated) flags.push({ code: "deprecated", severity: "high", detail: String(latest.deprecated) });
  if (lastPublishedDaysAgo === null) flags.push({ code: "publish_date_unknown", severity: "medium" });
  else if (lastPublishedDaysAgo > 730) flags.push({ code: "stale_over_2y", severity: "high", days: lastPublishedDaysAgo });
  else if (lastPublishedDaysAgo > 365) flags.push({ code: "stale_over_1y", severity: "medium", days: lastPublishedDaysAgo });
  if (maintainers === 0) flags.push({ code: "no_listed_maintainers", severity: "high" });
  else if (maintainers === 1) flags.push({ code: "single_maintainer", severity: "low" });
  if (weeklyDownloads !== null && weeklyDownloads < 100) flags.push({ code: "low_weekly_downloads", severity: "medium", downloads: weeklyDownloads });
  if (!latest.license && !metadata.license) flags.push({ code: "license_unknown", severity: "medium" });
  if (!repositoryUrl(latest.repository ?? metadata.repository)) flags.push({ code: "repository_missing", severity: "low" });
  const penalty = flags.reduce((total, flag) => total + ({ high: 25, medium: 12, low: 5 }[String(flag.severity)] ?? 0), 0);
  const score = Math.max(0, 100 - penalty);
  return {
    package: normalized,
    latestVersion,
    score,
    verdict: score >= 80 ? "low-obvious-risk" : score >= 55 ? "review" : "high-caution",
    flags,
    evidence: {
      lastPublishedAt,
      lastPublishedDaysAgo,
      weeklyDownloads,
      maintainers,
      license: latest.license ?? metadata.license ?? null,
      repository: repositoryUrl(latest.repository ?? metadata.repository),
    },
    generatedAt: new Date().toISOString(),
    methodology: "Public npm registry metadata and npm weekly download counts; heuristic, not a security audit.",
  };
}

Deno.serve(async (req: Request) => {
  const internalUrl = new URL(req.url);
  const suffix = internalUrl.pathname.replace(/^\/nano-npm-risk/, "");

  if (req.method === "GET" && (suffix === "/healthz" || suffix === "/" || suffix === "")) {
    await initialization;
    return json({ ok: true, paymentNetwork: "nano:mainnet", facilitator: FACILITATOR_URL, priceXno: PRICE, paymentConfigured: Boolean(PAY_TO) });
  }

  if (req.method !== "GET" || suffix !== "/v1/npm-risk") return json({ error: "not_found" }, 404);

  await initialization;
  const publicResourceUrl = `${PUBLIC_BASE}/v1/npm-risk${internalUrl.search}`;
  const config = {
    scheme: "exact",
    network: "nano:mainnet",
    price: PRICE,
    payTo: PAY_TO,
    description: "Evidence-backed npm package health and maintenance-risk report",
    mimeType: "application/json",
  };
  const requirements = (await resourceServer.buildPaymentRequirements(config))[0];
  const paymentHeader = req.headers.get("PAYMENT-SIGNATURE") || req.headers.get("X-PAYMENT");

  if (!paymentHeader) {
    const paymentRequired = await resourceServer.createPaymentRequiredResponse([requirements], {
      url: publicResourceUrl,
      description: config.description,
      mimeType: config.mimeType,
    });
    const encoded = btoa(JSON.stringify(paymentRequired));
    return json({ error: "payment_required", scheme: "exact", network: "nano:mainnet", price: `${PRICE} XNO` }, 402, { "PAYMENT-REQUIRED": encoded });
  }

  try {
    const payload = JSON.parse(atob(paymentHeader));
    const verified = await resourceServer.verifyPayment(payload, requirements);
    if (!verified.isValid) return json({ error: "invalid_payment", reason: verified.invalidReason }, 402);
    const settled = await resourceServer.settlePayment(payload, requirements);
    if (!settled.success) return json({ error: "settlement_failed", reason: settled.errorReason }, 402);
    const report = await buildNpmRiskReport(internalUrl.searchParams.get("package"));
    return json({ ...report, payment: settled.transaction ?? null }, 200, { "PAYMENT-RESPONSE": btoa(JSON.stringify(settled)) });
  } catch (error) {
    return json({ error: "request_failed", message: error instanceof Error ? error.message : String(error) }, 400);
  }
});
