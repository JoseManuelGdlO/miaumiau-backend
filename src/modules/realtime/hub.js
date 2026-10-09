function createHub() {
  const rooms = new Map();

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

  return { add, remove, notify, size };
}

module.exports = { createHub };
