const { WebSocket, WebSocketServer } = require('ws');

const DEFAULT_PATH = '/api/app-repartidor/ws';
const CALL_CENTER_PATH = '/api/call-center/ws';

function safeSend(ws, payload) {
  try {
    ws.send(JSON.stringify(payload), () => {});
  } catch {
    // El socket pudo morir entre el chequeo y el envío.
  }
}

function pathnameOf(req) {
  try {
    return new URL(req.url, 'http://127.0.0.1').pathname;
  } catch {
    return '';
  }
}

function attachRealtime(httpServer, options) {
  const hub = options.hub;
  const verifyToken = options.verifyToken;
  const verifyCallCenter = options.verifyCallCenter;
  const onGps = options.onGps;
  const socketPath = options.path || DEFAULT_PATH;
  const callCenterPath = options.callCenterPath || CALL_CENTER_PATH;
  const authTimeoutMs = options.authTimeoutMs ?? 5000;
  const gpsThrottleMs = options.gpsThrottleMs ?? 20000;
  const lastGps = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });

  function onUpgrade(req, socket, head) {
    const pathname = pathnameOf(req);
    if (pathname !== socketPath && pathname !== callCenterPath) {
      socket.destroy();
      return;
    }
    // Sin listener, un ECONNRESET en el socket crudo tumba el proceso.
    socket.on('error', () => socket.destroy());
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }

  wss.on('connection', (ws, req) => {
    ws.on('error', () => {});
    const isCallCenter = pathnameOf(req) === callCenterPath;
    let repartidorId = null;
    let callCenterOk = false;
    const timer = setTimeout(() => {
      if (repartidorId == null && !callCenterOk) ws.close(4001, 'auth timeout');
    }, authTimeoutMs);

    ws.on('message', async (data) => {
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (repartidorId == null && !callCenterOk) {
        if (message.type !== 'auth' || typeof message.token !== 'string') {
          clearTimeout(timer);
          ws.close(4003, 'auth required');
          return;
        }
        let user = null;
        try {
          user = isCallCenter
            ? await (typeof verifyCallCenter === 'function' ? verifyCallCenter(message.token) : null)
            : await verifyToken(message.token);
        } catch {
          user = null;
        }
        if (isCallCenter) {
          if (!user || user.userId == null) {
            clearTimeout(timer);
            ws.close(4003, 'token invalid');
            return;
          }
          clearTimeout(timer);
          if (ws.readyState !== WebSocket.OPEN) return;
          callCenterOk = true;
          hub.addCallCenter(ws);
          safeSend(ws, { type: 'ready' });
          return;
        }
        if (!user || user.repartidorId == null) {
          clearTimeout(timer);
          ws.close(4003, 'token invalid');
          return;
        }
        clearTimeout(timer);
        if (ws.readyState !== WebSocket.OPEN) return;
        repartidorId = user.repartidorId;
        hub.add(repartidorId, ws);
        safeSend(ws, { type: 'ready' });
        return;
      }
      if (message.type === 'ping') {
        safeSend(ws, { type: 'pong' });
        return;
      }
      if (!isCallCenter && message.type === 'gps') {
        const lat = Number(message.lat);
        const lng = Number(message.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const punto = { lat, lng };
        hub.broadcastGps(repartidorId, punto);
        const now = Date.now();
        if (now - (lastGps.get(repartidorId) || 0) < gpsThrottleMs) return;
        lastGps.set(repartidorId, now);
        if (typeof onGps === 'function') {
          try {
            await onGps(repartidorId, punto);
          } catch {
            // El pin ya salió por WS; la DB puede esperar al siguiente tick.
          }
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (repartidorId != null) hub.remove(repartidorId, ws);
      if (callCenterOk) hub.removeCallCenter(ws);
    });
  });

  httpServer.on('upgrade', onUpgrade);

  return function close() {
    httpServer.off('upgrade', onUpgrade);
    wss.close();
  };
}

module.exports = { attachRealtime, CALL_CENTER_PATH };
