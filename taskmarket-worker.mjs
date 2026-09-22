import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const bin = path.resolve('node_modules/.bin/taskmarket');
const home = process.env.HOME || '/data';
const outPath = path.join(home, 'taskmarket-submissions.json');

function run(args, {allowFailure=false}={}) {
  const r = spawnSync(bin, args, {encoding:'utf8', env:process.env});
  const stdout = (r.stdout || '').trim();
  const stderr = (r.stderr || '').trim();
  if (stdout) console.log(`$ taskmarket ${args.join(' ')}\n${stdout}`);
  if (stderr) console.error(stderr);
  if (r.status !== 0 && !allowFailure) throw new Error(`taskmarket ${args.join(' ')} exited ${r.status}`);
  return {status:r.status, stdout, stderr};
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function main() {
  console.log(`Taskmarket runner booting; HOME=${home}`);
  if (process.env.TASKMARKET_ENABLE !== '1') {
    console.log('TASKMARKET_ENABLE is not 1; runner is intentionally inert.');
    setInterval(()=>{}, 60_000);
    return;
  }

  fs.mkdirSync(home, {recursive:true});

  // Bootstrap a dedicated Taskmarket worker wallet only if one does not exist.
  const ks = path.join(home, '.taskmarket', 'keystore.json');
  if (!fs.existsSync(ks)) run(['init']);

  const addr = run(['address']).stdout;
  console.log(`TASKMARKET_WORKER_ADDRESS=${addr}`);

  // Never auto-accept legal terms. If enforcement becomes active and the current
  // wallet lacks a receipt, submissions will fail safely instead of assenting.
  const legal = run(['legal','status'], {allowFailure:true});
  console.log('LEGAL_STATUS_CHECKED');

  if (fs.existsSync(outPath)) {
    console.log(`Submission receipt file already exists at ${outPath}; refusing duplicate submissions.`);
    console.log(fs.readFileSync(outPath,'utf8'));
    setInterval(()=>{}, 60_000);
    return;
  }

  const tasks = [
    ['0xbf396ef8896446f96e50618d269761c089222aeefb3ffc14fed7d6513163072c','artifacts/lost-property-platform-13half.svg'],
    ['0x35aa2e5151870f5ba12edb37c35e8c906f0fb6df0938f23dee97a88bd30dfbcd','artifacts/tiny-house-weather.html'],
    ['0x2e0ef43d9ef75525f993d4ee3ae8b79d70f3a22b8c3829d1b7761f7d1ebd3205','artifacts/imaginary-household-pests.svg']
  ];

  const receipts = {walletAddress:addr, createdAt:new Date().toISOString(), submissions:[]};
  for (const [taskId,file] of tasks) {
    if (!fs.existsSync(file)) throw new Error(`Missing artifact ${file}`);
    const res = run(['task','submit',taskId,'--file',file]);
    const json = parseJson(res.stdout);
    receipts.submissions.push({taskId,file,response:json ?? res.stdout});
    // Persist after every successful write so a restart cannot blindly repeat it.
    fs.writeFileSync(outPath, JSON.stringify(receipts,null,2), {mode:0o600});
  }

  console.log('TASKMARKET_SUBMISSIONS_COMPLETE');
  console.log(JSON.stringify(receipts));
  setInterval(()=>{}, 60_000);
}

main().catch(err => {
  console.error('TASKMARKET_RUNNER_ERROR', err?.stack || String(err));
  process.exitCode = 1;
});
