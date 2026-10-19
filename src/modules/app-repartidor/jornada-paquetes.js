const { Op } = require('sequelize');

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function disponiblesDe(paquete, ciudadId) {
  const partes = paquete.productos || [];
  if (!partes.length) return 0;
  let maximo = Infinity;
  for (const parte of partes) {
    const producto = parte.producto;
    const porPaquete = Number(parte.cantidad) || 0;
    if (!producto || producto.baja_logica || porPaquete < 1) return 0;
    if (ciudadId && Number(producto.fkid_ciudad) !== Number(ciudadId)) return 0;
    const stock = Number(producto.stock_inicial) || 0;
    maximo = Math.min(maximo, Math.floor(stock / porPaquete));
  }
  return Number.isFinite(maximo) ? maximo : 0;
}

function componentes(paquete, cantidad) {
  return (paquete.productos || []).map((parte) => ({
    fkid_producto: parte.fkid_producto,
    nombre: parte.producto?.nombre || '',
    cantidad: (Number(parte.cantidad) || 0) * cantidad,
    precio_unidad: Number(parte.producto?.precio_venta) || 0,
    producto: parte.producto,
  }));
}

async function clienteTest(db, ciudadId, transaction) {
  const existing = await db.Cliente.findOne({
    where: {
      fkid_ciudad: ciudadId,
      nombre_completo: { [Op.like]: 'TEST%' },
    },
    order: [['id', 'ASC']],
    transaction,
  });
  if (existing) return existing;
  return db.Cliente.create({
    nombre_completo: 'TEST Extra',
    telefono: '6180000001',
    fkid_ciudad: ciudadId,
    direccion_entrega: 'Entrega extra de la ruta',
    canal_contacto: 'whatsapp',
    isActive: true,
  }, { transaction });
}

async function rutaDeHoy(db, { repartidorId, fecha, ciudadId, transaction }) {
  const ruta = await db.Ruta.findOne({
    where: {
      fkid_repartidor: repartidorId,
      fecha_ruta: fecha,
      estado: { [Op.ne]: 'cancelada' },
      baja_logica: false,
    },
    order: [['id', 'ASC']],
    transaction,
  });
  if (ruta) return ruta;
  return db.Ruta.create({
    nombre_ruta: 'Ruta del día',
    fecha_ruta: fecha,
    fkid_ciudad: ciudadId,
    fkid_repartidor: repartidorId,
    estado: 'planificada',
    total_pedidos: 0,
    baja_logica: false,
  }, { transaction });
}

async function moverStock(producto, delta, transaction) {
  const actual = Number(producto.stock_inicial) || 0;
  const next = actual + delta;
  if (next < 0) fail(422, `No hay suficiente ${producto.nombre || 'producto'}`);
  await producto.update({ stock_inicial: next }, { transaction });
}

async function listarPaquetesDisponibles(deps, { loadRepartidor, getModels }) {
  const db = getModels(deps);
  const repartidor = await loadRepartidor(deps);
  const ciudadId = repartidor?.fkid_ciudad || repartidor?.ciudad?.id;
  if (!ciudadId || typeof db.Paquete?.findAll !== 'function') return [];
  const rows = await db.Paquete.findAll({
    where: { is_active: true },
    include: [{
      model: db.ProductoPaquete,
      as: 'productos',
      required: true,
      include: [{ model: db.Inventario, as: 'producto', required: true }],
    }],
    order: [['nombre', 'ASC']],
  });
  return rows
    .map((row) => {
      const disponible = disponiblesDe(row, ciudadId);
      return {
        id: row.id,
        nombre: row.nombre,
        precio: Number(row.precio_final) || 0,
        disponible,
      };
    })
    .filter((row) => row.disponible > 0 && row.precio > 0);
}

async function agregarPaqueteParada(deps, hooks) {
  const cantidad = Number(deps.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1) fail(422, 'La cantidad del paquete no es válida');
  const jornada = await hooks.loadJornada(deps, { findOrCreate: true });
  if (!jornada) fail(404, 'Jornada no encontrada');
  if (jornada.estado && jornada.estado !== 'borrador') fail(409, 'La carga ya no admite paquetes');
  const db = hooks.getModels(deps);
  const repartidor = await hooks.loadRepartidor(deps);
  const ciudadId = repartidor?.fkid_ciudad || repartidor?.ciudad?.id;
  if (!ciudadId) fail(422, 'El repartidor no tiene ciudad');
  const paquete = await db.Paquete.findOne({
    where: { id: deps.fkid_paquete, is_active: true },
    include: [{
      model: db.ProductoPaquete,
      as: 'productos',
      include: [{ model: db.Inventario, as: 'producto' }],
    }],
  });
  if (!paquete) fail(422, 'Ese paquete no está disponible');
  const disponible = disponiblesDe(paquete, ciudadId);
  if (cantidad > disponible) fail(422, 'No hay suficientes paquetes en la bodega');
  const precio = Number(paquete.precio_final) || 0;
  if (precio <= 0) fail(422, 'El paquete no tiene precio');
  const lineas = componentes(paquete, cantidad);
  const total = Math.round(precio * cantidad * 100) / 100;

  await db.sequelize.transaction(async (transaction) => {
    const cliente = await clienteTest(db, ciudadId, transaction);
    const direccion = String(cliente.direccion_entrega || 'Entrega extra de la ruta');
    const pedido = await db.Pedido.create({
      fkid_cliente: cliente.id,
      telefono_referencia: cliente.telefono || null,
      direccion_entrega: direccion.length >= 10 ? direccion : 'Entrega extra de la ruta',
      fkid_ciudad: ciudadId,
      numero_pedido: `EXTRA-${Date.now()}`,
      estado: 'confirmado',
      metodo_pago: 'efectivo',
      subtotal: total,
      total,
      notas: `Paquete extra: ${paquete.nombre}`,
      baja_logica: false,
    }, { transaction });
    await db.PaquetePedido.create({
      fkid_pedido: pedido.id,
      fkid_paquete: paquete.id,
      cantidad,
      precio_unidad: precio,
      precio_total: total,
      descuento_paquete: 0,
    }, { transaction });
    for (const linea of lineas) {
      await db.ProductoPedido.create({
        fkid_pedido: pedido.id,
        fkid_producto: linea.fkid_producto,
        cantidad: linea.cantidad,
        precio_unidad: linea.precio_unidad || precio,
        precio_total: (linea.precio_unidad || precio) * linea.cantidad,
        baja_logica: false,
      }, { transaction });
      await moverStock(linea.producto, -linea.cantidad, transaction);
    }
    const ruta = await rutaDeHoy(db, { repartidorId: deps.repartidorId, fecha: deps.fecha, ciudadId, transaction });
    const ultimo = await db.RutaPedido.max('orden_entrega', { where: { fkid_ruta: ruta.id }, transaction });
    await db.RutaPedido.create({
      fkid_ruta: ruta.id,
      fkid_pedido: pedido.id,
      orden_entrega: (Number(ultimo) || 0) + 1,
      estado_entrega: 'pendiente',
    }, { transaction });
    await ruta.update({ total_pedidos: (Number(ruta.total_pedidos) || 0) + 1 }, { transaction });
  });
  return hooks.obtenerJornada(deps);
}

async function quitarPaqueteParada(deps, hooks) {
  const jornada = await hooks.loadJornada(deps, { findOrCreate: false });
  if (!jornada || (jornada.estado && jornada.estado !== 'borrador')) {
    fail(409, 'La carga ya no admite quitar paquetes');
  }
  const db = hooks.getModels(deps);
  const rutaPedido = await db.RutaPedido.findOne({
    where: { fkid_pedido: deps.pedidoId },
    include: [{
      model: db.Ruta,
      as: 'ruta',
      required: true,
      where: { fkid_repartidor: deps.repartidorId, fecha_ruta: deps.fecha },
    }, {
      model: db.Pedido,
      as: 'pedido',
      required: true,
    }],
  });
  const pedido = rutaPedido?.pedido;
  if (!pedido || !String(pedido.numero_pedido || '').startsWith('EXTRA-')) {
    fail(404, 'Esa parada extra no está en tu ruta');
  }
  if (pedido.estado === 'cancelado') return hooks.obtenerJornada(deps);
  const lineas = await db.ProductoPedido.findAll({
    where: { fkid_pedido: pedido.id, baja_logica: false },
    include: [{ model: db.Inventario, as: 'producto' }],
  });
  await db.sequelize.transaction(async (transaction) => {
    for (const linea of lineas) {
      if (linea.producto) await moverStock(linea.producto, Number(linea.cantidad) || 0, transaction);
    }
    await pedido.update({ estado: 'cancelado', baja_logica: true }, { transaction });
    await rutaPedido.update({ estado_entrega: 'fallido' }, { transaction });
  });
  return hooks.obtenerJornada(deps);
}

module.exports = {
  disponiblesDe,
  listarPaquetesDisponibles,
  agregarPaqueteParada,
  quitarPaqueteParada,
};
