function createHub() {
  const rooms = new Map();
  const callCenter = new Set();

  function room(repartidorId) {
    return rooms.get(Number(repartidorId));
  }

  function add(repartidorId, socket) {
    const id = Number(repartidorId);
    if (!rooms.has(id)) rooms.set(id, new Set());
    rooms.get(id).add(socket);
  }

  function remove(repartidorId, socket) {
    const set = room(repartidorId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) rooms.delete(Number(repartidorId));
  }

  function notify(repartidorId, event) {
    const set = room(repartidorId);
    if (!set) return 0;
    const payload = JSON.stringify(event);
    let sent = 0;
    for (const socket of set) {
      if (socket.readyState !== 1) {
        set.delete(socket);
        continue;
      }
      try {
        socket.send(payload);
        sent += 1;
      } catch {
        set.delete(socket);
      }
    }
    if (set.size === 0) rooms.delete(Number(repartidorId));
    return sent;
  }

  function size(repartidorId) {
    return room(repartidorId)?.size || 0;
  }

  function addCallCenter(socket) {
    callCenter.add(socket);
  }

  function removeCallCenter(socket) {
    callCenter.delete(socket);
  }

  function broadcastGps(repartidorId, punto) {
    const payload = JSON.stringify({
      type: 'gps',
      repartidorId: Number(repartidorId),
      lat: Number(punto.lat),
      lng: Number(punto.lng),
    });
    let sent = 0;
    for (const socket of callCenter) {
      if (socket.readyState !== 1) {
        callCenter.delete(socket);
        continue;
      }
      try {
        socket.send(payload);
        sent += 1;
      } catch {
        callCenter.delete(socket);
      }
    }
    return sent;
  }

  function callCenterSize() {
    return callCenter.size;
  }

  return { add, remove, notify, size, addCallCenter, removeCallCenter, broadcastGps, callCenterSize };
}

module.exports = { createHub };
