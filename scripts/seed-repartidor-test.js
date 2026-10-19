#!/usr/bin/env node
/**
 * Pedidos TEST para la app de repartidores.
 * Idempotente. Usa la base del .env del backend (no corre en el deploy).
 * No lo ejecutes contra Easypanel hasta confirmarlo.
 */
const db = require('../src/models');

const AXELL_EMAIL = 'axellromote45@gmail.com';
const AXELL_PHONE = '6181018282';

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

async function upsertCliente({ nombre, email, telefono, ciudadId, direccion }) {
  const existing = email
    ? await db.Cliente.findOne({ where: { email } })
    : await db.Cliente.findOne({ where: { nombre_completo: nombre } });
  if (existing) {
    await existing.update({
      nombre_completo: nombre,
      telefono,
      email: email || existing.email,
      fkid_ciudad: ciudadId,
      direccion_entrega: direccion,
      canal_contacto: 'whatsapp',
      isActive: true,
    });
    return existing;
  }
  return db.Cliente.create({
    nombre_completo: nombre,
    telefono,
    email: email || null,
    fkid_ciudad: ciudadId,
    direccion_entrega: direccion,
    canal_contacto: 'whatsapp',
    isActive: true,
  });
}

async function upsertPedido({ numero, cliente, ciudadId, direccion, total, metodo, producto }) {
  let pedido = await db.Pedido.findOne({ where: { numero_pedido: numero } });
  const fields = {
    fkid_cliente: cliente.id,
    telefono_referencia: AXELL_PHONE,
    email_referencia: AXELL_EMAIL,
    direccion_entrega: direccion,
    fkid_ciudad: ciudadId,
    estado: 'en_camino',
    subtotal: total,
    total,
    metodo_pago: metodo,
    notas: 'Pedido TEST de la app de repartidores',
    baja_logica: false,
  };
  if (pedido) {
    await pedido.update(fields);
  } else {
    pedido = await db.Pedido.create({ ...fields, numero_pedido: numero });
  }
  if (producto) {
    const line = await db.ProductoPedido.findOne({
      where: { fkid_pedido: pedido.id, fkid_producto: producto.id, baja_logica: false },
    });
    const lineFields = {
      cantidad: 1,
      precio_unidad: total,
      precio_total: total,
      baja_logica: false,
    };
    if (line) await line.update(lineFields);
    else {
      await db.ProductoPedido.create({
        fkid_pedido: pedido.id,
        fkid_producto: producto.id,
        ...lineFields,
      });
    }
  }
  return pedido;
}

async function main() {
  const ciudad = await db.City.findOne({ order: [['id', 'ASC']] });
  if (!ciudad) throw new Error('No hay ciudades en la base');
  const repartidor = await db.Repartidor.findOne({
    where: { baja_logica: false },
    order: [['id', 'ASC']],
  });
  if (!repartidor) throw new Error('No hay un repartidor activo para asignar la ruta TEST');
  const producto = await db.Inventario.findOne({
    where: { fkid_ciudad: ciudad.id },
    order: [['id', 'ASC']],
  }) || await db.Inventario.findOne({ order: [['id', 'ASC']] });

  const fecha = todayKey();
  const axell = await upsertCliente({
    nombre: 'TEST Axell',
    email: AXELL_EMAIL,
    telefono: AXELL_PHONE,
    ciudadId: ciudad.id,
    direccion: 'Av. 20 de Noviembre 100, Durango',
  });
  const otro = await upsertCliente({
    nombre: 'TEST Cliente Ruta',
    email: null,
    telefono: '6180000000',
    ciudadId: ciudad.id,
    direccion: 'Blvd. Francisco Villa 500, Durango',
  });

  const pedidos = [
    await upsertPedido({
      numero: 'TEST-AXELL-1',
      cliente: axell,
      ciudadId: ciudad.id,
      direccion: 'Av. 20 de Noviembre 100, Durango, Dgo.',
      total: 180,
      metodo: 'efectivo',
      producto,
    }),
    await upsertPedido({
      numero: 'TEST-RUTA-2',
      cliente: otro,
      ciudadId: ciudad.id,
      direccion: 'Blvd. Francisco Villa 500, Durango, Dgo.',
      total: 240,
      metodo: 'transferencia',
      producto,
    }),
  ];
  const coords = [
    { lat: 24.02772, lng: -104.653175 },
    { lat: 24.04021, lng: -104.66742 },
  ];

  let ruta = await db.Ruta.findOne({
    where: { nombre_ruta: 'TEST ruta repartidor', fecha_ruta: fecha, fkid_repartidor: repartidor.id },
  });
  if (!ruta) {
    ruta = await db.Ruta.create({
      nombre_ruta: 'TEST ruta repartidor',
      fecha_ruta: fecha,
      fkid_ciudad: ciudad.id,
      fkid_repartidor: repartidor.id,
      estado: 'en_progreso',
      total_pedidos: pedidos.length,
      baja_logica: false,
    });
  } else {
    await ruta.update({ estado: 'en_progreso', total_pedidos: pedidos.length, baja_logica: false });
  }

  for (let index = 0; index < pedidos.length; index += 1) {
    const pedido = pedidos[index];
    const point = coords[index];
    const link = `https://maps.google.com/?q=${point.lat},${point.lng}`;
    const existing = await db.RutaPedido.findOne({
      where: { fkid_ruta: ruta.id, fkid_pedido: pedido.id },
    });
    const fields = {
      orden_entrega: index + 1,
      estado_entrega: 'pendiente',
      lat: point.lat,
      lng: point.lng,
      link_ubicacion: link,
    };
    if (existing) await existing.update(fields);
    else await db.RutaPedido.create({ fkid_ruta: ruta.id, fkid_pedido: pedido.id, ...fields });
  }

  console.log(`Ruta TEST ${ruta.id} del ${fecha} para repartidor ${repartidor.id} (${repartidor.nombre_completo || repartidor.email || ''})`);
  console.log(`Pedidos: ${pedidos.map((pedido) => pedido.numero_pedido).join(', ')}`);
  console.log(`El código de WhatsApp sale al ${AXELL_PHONE}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
