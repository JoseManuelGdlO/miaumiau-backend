const clients = new Set();
const HEARTBEAT_MS = 25000;

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function publishNotificacion(notificacion) {
  if (!notificacion) return;
  const payload = typeof notificacion.toJSON === 'function'
    ? notificacion.toJSON()
    : notificacion;

  for (const res of clients) {
    try {
      writeEvent(res, 'notification', payload);
    } catch {
      clients.delete(res);
    }
  }
}

function openStream(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  clients.add(res);
  writeEvent(res, 'ready', { ok: true });

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, HEARTBEAT_MS);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

module.exports = {
  publishNotificacion,
  openStream,
};
