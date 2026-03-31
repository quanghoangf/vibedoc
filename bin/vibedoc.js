#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const net = require('net');

const PKG_DIR = path.resolve(__dirname, '..');
const VIBEDOC_ROOT = process.env.VIBEDOC_ROOT || process.cwd();

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    // Port 0 lets the OS assign a random free port
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function main() {
  // If PORT/WS_PORT are explicitly set, respect them; otherwise find free ports
  const port = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : await findFreePort();
  const wsPort = process.env.WS_PORT
    ? parseInt(process.env.WS_PORT, 10)
    : await findFreePort();

  console.log(`[vibedoc] Starting...`);
  console.log(`[vibedoc] Project root: ${VIBEDOC_ROOT}`);
  console.log(`[vibedoc] App: http://localhost:${port}`);
  console.log(`[vibedoc] WS:  ws://localhost:${wsPort}`);

  const env = { ...process.env, VIBEDOC_ROOT, PORT: String(port), WS_PORT: String(wsPort) };

  const next = spawn(
    process.execPath,
    [require.resolve('next/dist/bin/next', { paths: [PKG_DIR] }), 'start', '--port', String(port)],
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
}

main().catch(err => {
  console.error('[vibedoc] Startup error:', err.message);
  process.exit(1);
});
