const { createHub } = require('./hub');

function fakeSocket() {
  return {
    readyState: 1,
    payloads: [],
    send(payload) {
      this.payloads.push(payload);
    },
  };
}

test('notify entrega el JSON solo a la sala de ese repartidor', () => {
  const hub = createHub();
  const a = fakeSocket();
  const b = fakeSocket();
  hub.add(4, a);
  hub.add('4', b);
  hub.add(9, fakeSocket());
  expect(hub.notify(4, { type: 'jornada.actualizada' })).toBe(2);
  expect(a.payloads).toEqual(['{"type":"jornada.actualizada"}']);
  expect(b.payloads).toEqual(['{"type":"jornada.actualizada"}']);
  expect(hub.size(9)).toBe(1);
});

test('notify descarta sockets cerrados y los que fallan al enviar', () => {
  const hub = createHub();
  const closed = fakeSocket();
  closed.readyState = 3;
  const broken = fakeSocket();
  broken.send = () => {
    throw new Error('cerrado');
  };
  hub.add(4, closed);
  hub.add(4, broken);
  expect(hub.notify(4, { type: 'ready' })).toBe(0);
  expect(hub.size(4)).toBe(0);
});

test('remove deja la sala vacía y notify sin sala devuelve 0', () => {
  const hub = createHub();
  const socket = fakeSocket();
  hub.add(4, socket);
  hub.remove(4, socket);
  expect(hub.size(4)).toBe(0);
  expect(hub.notify(4, { type: 'ready' })).toBe(0);
});
