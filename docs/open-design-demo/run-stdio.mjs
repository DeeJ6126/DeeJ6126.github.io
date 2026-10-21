// Drive one Open Design run over the dsh profile-stdio protocol.
// Injects SKILL.md + DESIGN.md + brief, waits for the result frame, reports output.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const NODE = 'C:\\Users\\Dee\\AppData\\Local\\OpenDesign\\toolchains\\dsh\\node-v24.19.0-win-x64\\node.exe';
const DSH = 'C:\\Users\\Dee\\AppData\\Local\\OpenDesign\\toolchains\\dsh\\runtime-dsh-0.1.0-rc.6\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js';

const args = process.argv.slice(2);
const cwd = args[0];
const promptFile = args[1];

const prompt = readFileSync(promptFile, 'utf8');
const child = spawn(NODE, [DSH, '--profile', 'open-design', '--stdio'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

const rl = createInterface({ input: child.stdout });
const errLines = [];
child.stderr.on('data', (chunk) => errLines.push(chunk.toString()));

const frames = [];
rl.on('line', (line) => {
  try {
    const frame = JSON.parse(line);
    frames.push(frame);
    if (frame.type === 'result') {
      console.log(`[result] status=${frame.status} stop=${frame.stop_reason} session=${frame.session_id}`);
    } else if (frame.type === 'text') {
      console.log(`[text] ${String(frame.text || '').slice(0, 120)}`);
    }
  } catch {
    /* non-json noise */
  }
});

const timeout = setTimeout(() => {
  console.error('TIMEOUT: no result within 600s');
  child.kill();
  process.exit(1);
}, 600_000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  const result = frames.find((f) => f.type === 'result');
  if (result) {
    console.log('=== DONE ===');
    console.log(`status=${result.status} output=${(result.output || '').slice(0, 300)}`);
    process.exit(result.status === 'completed' ? 0 : 2);
  }
  console.error('no result frame; exit', code);
  if (errLines.length) console.error('stderr tail:', errLines.join('').slice(-800));
  process.exit(3);
});

setTimeout(() => {
  const command = {
    v: 1,
    type: 'execute',
    request_id: randomUUID(),
    cwd,
    prompt,
    mcp_servers: [],
  };
  console.log(`[send] execute cwd=${cwd} promptBytes=${Buffer.byteLength(prompt)}`);
  child.stdin.write(`${JSON.stringify(command)}\n`);
}, 3_000);
