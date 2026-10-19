function agregarLineas(lineas) {
  const grouped = new Map();
  for (const line of lineas || []) {
    const nombre = String(line?.nombre || '').trim();
    const cantidad = Number(line?.cantidad) || 0;
    if (!nombre || cantidad < 1) continue;
    const prev = grouped.get(nombre) || {
      nombre,
      fkid_producto: line.fkid_producto ?? null,
      cantidad: 0,
    };
    prev.cantidad += cantidad;
    if (prev.fkid_producto == null && line.fkid_producto != null) {
      prev.fkid_producto = line.fkid_producto;
    }
    grouped.set(nombre, prev);
  }
  return [...grouped.values()];
}

function opts(transaction) {
  return transaction ? { transaction } : {};
}

async function reemplazarSaldo(db, { repartidorId, jornadaId, lineas, transaction }) {
  const rows = agregarLineas(lineas);
  const query = opts(transaction);
  await db.InventarioVehiculo.destroy({ where: { fkid_repartidor: repartidorId }, ...query });
  for (const row of rows) {
    await db.InventarioVehiculo.create({
      fkid_repartidor: repartidorId,
      fkid_producto: row.fkid_producto,
      nombre: row.nombre,
      cantidad: row.cantidad,
    }, query);
    await db.MovimientoInventarioVehiculo.create({
      fkid_repartidor: repartidorId,
      fkid_producto: row.fkid_producto,
      nombre: row.nombre,
      tipo: 'carga',
      cantidad: row.cantidad,
      fkid_jornada: jornadaId ?? null,
      fkid_pedido: null,
    }, query);
  }
  return rows;
}

async function descontarEntrega(db, { repartidorId, jornadaId, pedidoId, items, transaction }) {
  const query = opts(transaction);
  for (const item of items || []) {
    const nombre = String(item?.nombre || '').trim();
    const cantidad = Number(item?.cantidad) || 0;
    if (!nombre || cantidad < 1) continue;
    const saldo = await db.InventarioVehiculo.findOne({
      where: { fkid_repartidor: repartidorId, nombre },
      ...query,
    });
    const actual = Number(saldo?.cantidad) || 0;
    const next = Math.max(0, actual - cantidad);
    const delta = next - actual;
    if (saldo) await saldo.update({ cantidad: next }, query);
    if (delta !== 0) {
      await db.MovimientoInventarioVehiculo.create({
        fkid_repartidor: repartidorId,
        fkid_producto: item.fkid_producto ?? saldo?.fkid_producto ?? null,
        nombre,
        tipo: 'entrega',
        cantidad: delta,
        fkid_jornada: jornadaId ?? null,
        fkid_pedido: pedidoId ?? null,
      }, query);
    }
  }
}

async function anotarAjuste(db, { repartidorId, jornadaId, pedidoId, nombre, fkid_producto, cantidad }) {
  const qty = Number(cantidad) || 0;
  const label = String(nombre || '').trim();
  if (!label || qty < 1 || typeof db.InventarioVehiculo?.findOne !== 'function') return;
  const saldo = await db.InventarioVehiculo.findOne({
    where: { fkid_repartidor: repartidorId, nombre: label },
  });
  // La carga del día ya está en el saldo y la entrega solo descuenta lo confirmado.
  // Sumar aquí contaría dos veces las piezas que se quedan en la camioneta.
  if (saldo) return;
  await db.InventarioVehiculo.create({
    fkid_repartidor: repartidorId,
    fkid_producto: fkid_producto ?? null,
    nombre: label,
    cantidad: qty,
  });
  if (typeof db.MovimientoInventarioVehiculo?.create !== 'function') return;
  await db.MovimientoInventarioVehiculo.create({
    fkid_repartidor: repartidorId,
    fkid_producto: fkid_producto ?? null,
    nombre: label,
    tipo: 'ajuste',
    cantidad: qty,
    fkid_jornada: jornadaId ?? null,
    fkid_pedido: pedidoId ?? null,
  });
}

module.exports = {
  agregarLineas,
  reemplazarSaldo,
  descontarEntrega,
  anotarAjuste,
};
