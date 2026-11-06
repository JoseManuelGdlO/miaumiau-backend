const http = require('http');
const { WebSocket } = require('ws');
const { createHub } = require('./hub');
const { attachRealtime } = require('./attach');

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function openSocket(port, path) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    ws.on('error', reject);
    ws.on('open', () => resolve(ws));
  });
}

function onceMessage(ws) {
  return new Promise((resolve) => ws.once('message', (data) => resolve(JSON.parse(String(data)))));
}

function onceClose(ws) {
  return new Promise((resolve) => ws.once('close', (code) => resolve(code)));
}

test('el handshake mete al repartidor en su sala y responde ready', async () => {
  const hub = createHub();
  const server = http.createServer();
  const close = attachRealtime(server, {
    hub,
    path: '/api/app-repartidor/ws',
    authTimeoutMs: 500,
    verifyToken: async (token) => (token === 'ok' ? { repartidorId: 4 } : null),
  });
  const port = await listen(server);
  const ws = await openSocket(port, '/api/app-repartidor/ws');
  const ready = onceMessage(ws);
  ws.send(JSON.stringify({ type: 'auth', token: 'ok' }));
  await expect(ready).resolves.toEqual({ type: 'ready' });
  const notified = onceMessage(ws);
  expect(hub.notify(4, { type: 'jornada.actualizada' })).toBe(1);
  await expect(notified).resolves.toEqual({ type: 'jornada.actualizada' });
  const pong = onceMessage(ws);
  ws.send(JSON.stringify({ type: 'ping' }));
  await expect(pong).resolves.toEqual({ type: 'pong' });
  ws.close();
  await close();
  server.close();
});

test('cierra 4003 si el token no sirve', async () => {
  const server = http.createServer();
  const close = attachRealtime(server, {
    hub: createHub(),
    authTimeoutMs: 500,
    verifyToken: async () => null,
  });
  const port = await listen(server);
  const ws = await openSocket(port, '/api/app-repartidor/ws');
  const closed = onceClose(ws);
  ws.send(JSON.stringify({ type: 'auth', token: 'no' }));
  await expect(closed).resolves.toBe(4003);
  await close();
  server.close();
});

test('cierra 4001 si nadie se autentica a tiempo', async () => {
  const server = http.createServer();
  const close = attachRealtime(server, {
    hub: createHub(),
    authTimeoutMs: 50,
    verifyToken: async () => ({ repartidorId: 1 }),
  });
  const port = await listen(server);
  const ws = await openSocket(port, '/api/app-repartidor/ws');
  await expect(onceClose(ws)).resolves.toBe(4001);
  await close();
  server.close();
});

test('un error en el websocket del servidor no tumba el proceso', async () => {
  const hub = createHub();
  let serverSocket = null;
  const originalAdd = hub.add;
  hub.add = (id, ws) => {
    serverSocket = ws;
    return originalAdd(id, ws);
  };
  const server = http.createServer();
  const close = attachRealtime(server, {
    hub,
    authTimeoutMs: 500,
    verifyToken: async () => ({ repartidorId: 9 }),
  });
  const port = await listen(server);
  const ws = await openSocket(port, '/api/app-repartidor/ws');
  const ready = onceMessage(ws);
  ws.send(JSON.stringify({ type: 'auth', token: 'ok' }));
  await expect(ready).resolves.toEqual({ type: 'ready' });
  expect(serverSocket).not.toBeNull();
  expect(() => serverSocket.emit('error', new Error('ECONNRESET'))).not.toThrow();
  const closed = onceClose(ws);
  serverSocket.terminate();
  await closed;
  expect(hub.notify(9, { type: 'x' })).toBe(0);
  await close();
  server.close();
});

test('no registra en el hub un socket que el timer ya cerró mientras verificaba el token', async () => {
  const hub = createHub();
  const add = jest.spyOn(hub, 'add');
  const server = http.createServer();
  const close = attachRealtime(server, {
    hub,
    authTimeoutMs: 50,
    verifyToken: () => new Promise((resolve) => setTimeout(() => resolve({ repartidorId: 2 }), 200)),
  });
  const port = await listen(server);
  const ws = await openSocket(port, '/api/app-repartidor/ws');
  const closed = onceClose(ws);
  ws.send(JSON.stringify({ type: 'auth', token: 'ok' }));
  await expect(closed).resolves.toBe(4001);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(add).not.toHaveBeenCalled();
  await close();
  server.close();
});

test('gps del repartidor llega a Call Center y persiste throttled', async () => {
  const hub = createHub();
  const onGps = jest.fn(async () => {});
  const server = http.createServer();
  const close = attachRealtime(server, {
    hub,
    authTimeoutMs: 500,
    gpsThrottleMs: 50,
    verifyToken: async () => ({ repartidorId: 4 }),
    verifyCallCenter: async () => ({ userId: 9 }),
    onGps,
  });
  const port = await listen(server);
  const driver = await openSocket(port, '/api/app-repartidor/ws');
  const cc = await openSocket(port, '/api/call-center/ws');
  const driverReady = onceMessage(driver);
  const ccReady = onceMessage(cc);
  driver.send(JSON.stringify({ type: 'auth', token: 'ok' }));
  cc.send(JSON.stringify({ type: 'auth', token: 'ok' }));
  await driverReady;
  await ccReady;
  const gps = onceMessage(cc);
  driver.send(JSON.stringify({ type: 'gps', lat: 24.02, lng: -104.66 }));
  await expect(gps).resolves.toEqual({ type: 'gps', repartidorId: 4, lat: 24.02, lng: -104.66 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(onGps).toHaveBeenCalledTimes(1);
  driver.send(JSON.stringify({ type: 'gps', lat: 24.03, lng: -104.67 }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(onGps).toHaveBeenCalledTimes(1);
  driver.close();
  cc.close();
  await close();
  server.close();
});
