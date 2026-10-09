const { WebSocket, WebSocketServer } = require('ws');

const DEFAULT_PATH = '/api/app-repartidor/ws';

function safeSend(ws, payload) {
  try {
    ws.send(JSON.stringify(payload), () => {});
  } catch {
    // El socket pudo morir entre el chequeo y el envío.
  }
}

function attachRealtime(httpServer, options) {
  const hub = options.hub;
  const verifyToken = options.verifyToken;
  const socketPath = options.path || DEFAULT_PATH;
  const authTimeoutMs = options.authTimeoutMs ?? 5000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });

  function onUpgrade(req, socket, head) {
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== socketPath) {
      socket.destroy();
      return;
    }
    // Sin listener, un ECONNRESET en el socket crudo tumba el proceso.
    socket.on('error', () => socket.destroy());
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }

  wss.on('connection', (ws) => {
    // Tragarse el error es intencional: close ya limpia el hub y un reset no debe matar Node.
    ws.on('error', () => {});
    let repartidorId = null;
    const timer = setTimeout(() => {
      if (repartidorId == null) ws.close(4001, 'auth timeout');
    }, authTimeoutMs);

    ws.on('message', async (data) => {
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (repartidorId == null) {
        if (message.type !== 'auth' || typeof message.token !== 'string') {
          clearTimeout(timer);
          ws.close(4003, 'auth required');
          return;
        }
        let user = null;
        try {
          user = await verifyToken(message.token);
        } catch {
          user = null;
        }
        if (!user || user.repartidorId == null) {
          clearTimeout(timer);
          ws.close(4003, 'token invalid');
          return;
        }
        clearTimeout(timer);
        // El timer de auth (o el cliente) pudo cerrar el socket mientras verificábamos.
        if (ws.readyState !== WebSocket.OPEN) return;
        repartidorId = user.repartidorId;
        hub.add(repartidorId, ws);
        safeSend(ws, { type: 'ready' });
        return;
      }
      if (message.type === 'ping') safeSend(ws, { type: 'pong' });
    });

    ws.on('close', () => {
      clearTimeout(timer);
      if (repartidorId != null) hub.remove(repartidorId, ws);
    });
  });

  httpServer.on('upgrade', onUpgrade);

  return function close() {
    httpServer.off('upgrade', onUpgrade);
    wss.close();
  };
}

module.exports = { attachRealtime };
