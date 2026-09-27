import { HTTPFacilitatorClient, x402ResourceServer } from 'npm:@x402/core@2.26.0/server';
import { ExactEvmScheme } from 'npm:@x402/evm@2.26.0/exact/server';

const PAY_TO = '0xf200174de10c26ce7670aaf41d69a8979fe5629d' as `0x${string}`;
const NETWORK = 'eip155:8453';
const PRICE = '$0.01';
const FACILITATOR = 'https://facilitator.payai.network';
const PUBLIC_BASE = 'https://tkoqkknsezxavtxfywkm.supabase.co/functions/v1/base-data-reconcile';
const PAID_URL = `${PUBLIC_BASE}/v1/reconcile`;
const SOURCE_URL = 'https://github.com/Jay44333/startup-credits/blob/ops-control-nano-seller/ops-control-base-reconcile/index.ts';
const MAX_ROWS = 500;
const MAX_BODY_BYTES = 512_000;
const SAMPLE = { key: 'id', left: [{ id: 'A', status: 'open', amount: 10 }, { id: 'B', status: 'closed', amount: 20 }], right: [{ id: 'A', status: 'closed', amount: 10 }, { id: 'C', status: 'open', amount: 30 }] };

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR });
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());
const initialization = resourceServer.initialize();

type Primitive = string | number | boolean | null;
type Row = Record<string, Primitive>;
type Input = { key: string; left: Row[]; right: Row[]; compareFields?: string[] };

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}
function isPrimitive(v: unknown): v is Primitive { return v === null || ['string','number','boolean'].includes(typeof v); }
function validate(input: unknown): { ok: true; value: Input } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'body_must_be_object' };
  const x = input as Partial<Input>;
  if (typeof x.key !== 'string' || !x.key.trim() || x.key.length > 100) return { ok: false, error: 'invalid_key' };
  if (!Array.isArray(x.left) || !Array.isArray(x.right)) return { ok: false, error: 'left_and_right_must_be_arrays' };
  if (x.left.length > MAX_ROWS || x.right.length > MAX_ROWS) return { ok: false, error: `max_${MAX_ROWS}_rows_per_side` };
  for (const row of [...x.left, ...x.right]) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return { ok: false, error: 'rows_must_be_objects' };
    for (const [k,v] of Object.entries(row)) if (k.length > 100 || !isPrimitive(v)) return { ok: false, error: 'only_shallow_primitive_fields_supported' };
  }
  if (x.compareFields !== undefined && (!Array.isArray(x.compareFields) || x.compareFields.some(f => typeof f !== 'string' || !f || f.length > 100))) return { ok: false, error: 'invalid_compareFields' };
  return { ok: true, value: { key: x.key.trim(), left: x.left as Row[], right: x.right as Row[], compareFields: x.compareFields } };
}
function canonical(v: Primitive | undefined) { return v === undefined ? '__MISSING__' : JSON.stringify(v); }
function reconcile(input: Input) {
  const { key, left, right } = input;
  const lm = new Map<string,Row>(), rm = new Map<string,Row>();
  const ld = new Set<string>(), rd = new Set<string>();
  const ml:number[] = [], mr:number[] = [];
  const load = (rows:Row[], map:Map<string,Row>, dup:Set<string>, missing:number[]) => rows.forEach((row,i) => {
    const raw = row[key];
    if (raw === undefined || raw === null || String(raw).length === 0) { missing.push(i); return; }
    const id = canonical(raw); if (map.has(id)) dup.add(id); else map.set(id,row);
  });
  load(left,lm,ld,ml); load(right,rm,rd,mr);
  const leftOnly:Primitive[] = [], rightOnly:Primitive[] = [];
  for (const [id,row] of lm) if (!rm.has(id)) leftOnly.push(row[key]);
  for (const [id,row] of rm) if (!lm.has(id)) rightOnly.push(row[key]);
  const differences:Array<{key:Primitive;fields:Array<{field:string;left:Primitive|'__MISSING__';right:Primitive|'__MISSING__'}>}> = [];
  for (const [id,lrow] of lm) {
    const rrow = rm.get(id); if (!rrow) continue;
    const fields = input.compareFields?.length ? input.compareFields.filter(f=>f!==key) : [...new Set([...Object.keys(lrow),...Object.keys(rrow)])].filter(f=>f!==key).sort();
    const changes:Array<{field:string;left:Primitive|'__MISSING__';right:Primitive|'__MISSING__'}> = [];
    for (const field of fields) { const lv=lrow[field], rv=rrow[field]; if (canonical(lv)!==canonical(rv)) changes.push({field,left:lv===undefined?'__MISSING__':lv,right:rv===undefined?'__MISSING__':rv}); }
    if (changes.length) differences.push({key:lrow[key],fields:changes});
  }
  const decode=(id:string):Primitive=>JSON.parse(id);
  return { key, summary:{leftRows:left.length,rightRows:right.length,matchedUniqueKeys:[...lm.keys()].filter(k=>rm.has(k)).length,leftOnly:leftOnly.length,rightOnly:rightOnly.length,changedKeys:differences.length,duplicateKeysLeft:ld.size,duplicateKeysRight:rd.size,missingKeyRowsLeft:ml.length,missingKeyRowsRight:mr.length}, leftOnlyKeys:leftOnly,rightOnlyKeys:rightOnly,duplicateKeysLeft:[...ld].map(decode),duplicateKeysRight:[...rd].map(decode),missingKeyRowIndexesLeft:ml,missingKeyRowIndexesRight:mr,differences,methodology:'Shallow deterministic key-based comparison. No files or records are retained by this function.',generatedAt:new Date().toISOString() };
}

const rowSchema = { type:'object', additionalProperties:{ type:['string','number','boolean','null'] } };
const inputSchema = { type:'object', required:['key','left','right'], properties:{ key:{type:'string',minLength:1,maxLength:100}, left:{type:'array',maxItems:MAX_ROWS,items:rowSchema}, right:{type:'array',maxItems:MAX_ROWS,items:rowSchema}, compareFields:{type:'array',items:{type:'string'},maxItems:100} }, additionalProperties:false };
const openApi = {
  openapi:'3.1.0',
  info:{ title:'Ops Control HQ JSON Record Reconciliation x402 API', version:'2026.09.27.1', description:'Deterministic key-based reconciliation for two shallow JSON record sets. Use it when an agent needs missing keys, duplicate keys, or changed-field evidence across two exports.', contact:{email:'opscontrolhq@outlook.com'} },
  servers:[{url:PUBLIC_BASE}],
  'x-discovery':{ownershipProofs:[PAY_TO],source:SOURCE_URL},
  paths:{ '/v1/reconcile':{ post:{ operationId:'reconcileJsonRecords', summary:'Compare two JSON record sets by key', tags:['Data quality'], requestBody:{required:true,content:{'application/json':{schema:inputSchema,example:SAMPLE}}}, 'x-payment-info':{protocols:[{x402:{}}],price:{mode:'fixed',currency:'USD',amount:'0.01'},network:NETWORK,asset:'USDC',payTo:PAY_TO}, responses:{'200':{description:'Paid reconciliation report',content:{'application/json':{schema:{type:'object'}}}},'400':{description:'Invalid input'},'402':{description:'Payment Required'},'413':{description:'Body too large'}} } } }
};
const wellKnown = { version:1, resources:[PAID_URL], ownershipProofs:[PAY_TO], instructions:'POST JSON with key,left,right and optional compareFields. Runtime 402 is authoritative.', openapi:`${PUBLIC_BASE}/openapi.json`, source:SOURCE_URL };

Deno.serve(async (req:Request) => {
  const internalUrl = new URL(req.url);
  const suffix = internalUrl.pathname.replace(/^\/base-data-reconcile/,'');
  if (req.method==='GET' && (suffix==='/'||suffix===''||suffix==='/healthz')) { await initialization; return json({ok:true,service:'json-record-reconciliation-x402',version:'2026.09.27.1',priceUsd:0.01,network:NETWORK,payTo:PAY_TO,maxRowsPerSide:MAX_ROWS,discovery:{openapi:`${PUBLIC_BASE}/openapi.json`,x402:`${PUBLIC_BASE}/.well-known/x402`,source:SOURCE_URL}}); }
  if (req.method==='GET' && suffix==='/openapi.json') return json(openApi);
  if (req.method==='GET' && suffix==='/.well-known/x402') return json(wellKnown);
  if (req.method==='GET' && suffix==='/llms.txt') return new Response(`Ops Control HQ JSON Record Reconciliation x402 API\nPaid: POST ${PAID_URL}\nPrice: $0.01 USDC on Base (eip155:8453), x402 v2 exact\nOpenAPI: ${PUBLIC_BASE}/openapi.json\nDiscovery: ${PUBLIC_BASE}/.well-known/x402\nFree sample: ${PUBLIC_BASE}/sample\n`,{headers:{'content-type':'text/plain; charset=utf-8'}});
  if (req.method==='GET' && suffix==='/sample') return json(reconcile(SAMPLE));
  if (req.method!=='POST'||suffix!=='/v1/reconcile') return json({error:'not_found'},404);
  const contentLength=Number(req.headers.get('content-length')||'0'); if(contentLength>MAX_BODY_BYTES) return json({error:'body_too_large'},413);
  let parsed:unknown; try{parsed=await req.json();}catch{return json({error:'invalid_json'},400);} const check=validate(parsed); if(!check.ok)return json({error:check.error},400);
  await initialization;
  const config={scheme:'exact',network:NETWORK,price:PRICE,payTo:PAY_TO,description:'Compare two JSON record sets by key and return missing keys, duplicates, and changed fields',mimeType:'application/json'};
  const requirements=(await resourceServer.buildPaymentRequirements(config))[0];
  const paymentHeader=req.headers.get('PAYMENT-SIGNATURE')||req.headers.get('X-PAYMENT');
  if(!paymentHeader){const paymentRequired=await resourceServer.createPaymentRequiredResponse([requirements],{url:PAID_URL,description:config.description,mimeType:config.mimeType}); return json({error:'payment_required',x402Version:2,network:NETWORK,price:PRICE},402,{'PAYMENT-REQUIRED':btoa(JSON.stringify(paymentRequired))});}
  try{const payload=JSON.parse(atob(paymentHeader));const verified=await resourceServer.verifyPayment(payload,requirements);if(!verified.isValid)return json({error:'invalid_payment',reason:verified.invalidReason},402);const settled=await resourceServer.settlePayment(payload,requirements);if(!settled.success)return json({error:'settlement_failed',reason:settled.errorReason},402);console.log(`RECON_X402_SETTLED ${JSON.stringify({transaction:settled.transaction??null,at:new Date().toISOString()})}`);return json({...reconcile(check.value),payment:settled.transaction??null},200,{'PAYMENT-RESPONSE':btoa(JSON.stringify(settled))});}catch(error){return json({error:'request_failed',message:error instanceof Error?error.message:String(error)},400);}
});
