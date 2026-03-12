#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const PKG_DIR = path.resolve(__dirname, '..');
const VIBEDOC_ROOT = process.env.VIBEDOC_ROOT || process.cwd();
const PORT = process.env.PORT || '3000';
const WS_PORT = process.env.WS_PORT || '1234';

console.log(`[vibedoc] Starting...`);
console.log(`[vibedoc] Project root: ${VIBEDOC_ROOT}`);
console.log(`[vibedoc] App: http://localhost:${PORT}`);
console.log(`[vibedoc] WS:  ws://localhost:${WS_PORT}`);

const env = { ...process.env, VIBEDOC_ROOT };

const next = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next', { paths: [PKG_DIR] }), 'start', '--port', PORT],
  { cwd: PKG_DIR, stdio: 'inherit', env }
);

const ws = spawn(
  process.execPath,
  [path.join(PKG_DIR, 'ws-server.js')],
  { cwd: PKG_DIR, stdio: 'inherit', env }
);

function shutdown() {
  next.kill();
  ws.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

next.on('error', err => {
  console.error('[vibedoc] Failed to start Next.js server:', err.message);
  process.exit(1);
});

next.on('exit', code => process.exit(code ?? 0));

ws.on('error', err => {
  console.error('[vibedoc] Failed to start WebSocket server:', err.message);
});

ws.on('exit', code => {
  if (code !== 0 && code !== null) {
    console.error(`[vibedoc] WebSocket server exited with code ${code}`);
  }
});
