const { dayKey } = require('../app-repartidor/domain');

const NOTA_COLA = 'Volvió a la cola: no se entregó el día anterior.';

function diaSiguiente(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

function datosReencole(notas, fecha) {
  const previas = String(notas || '');
  return {
    fecha_entrega_estimada: new Date(`${fecha}T12:00:00.000Z`),
    estado: 'confirmado',
    notas: (previas.includes(NOTA_COLA) ? previas : `${previas ? `${previas}\n` : ''}${NOTA_COLA}`).slice(0, 1000),
  };
}

async function encolarAlDiaSiguiente(pedido, hoy) {
  if (!pedido || pedido.baja_logica || pedido.estado === 'cancelado' || pedido.estado === 'entregado') return pedido;
  const base = String(hoy || '').slice(0, 10);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(base) ? diaSiguiente(base) : diaSiguiente(dayKey(new Date(), 'America/Mexico_City'));
  const data = datosReencole(pedido.notas, fecha);
  if (typeof pedido.update === 'function') await pedido.update(data);
  else Object.assign(pedido, data);
  return pedido;
}

function diaAnterior(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

async function reencolarNoEntregados() {
  // La fecha nueva la confirma un super admin. Este barrido ya no mueve pedidos.
  return 0;
}

async function soltarParadasAbiertas(db, repartidorId, fecha) {
  if (typeof db?.Ruta?.findAll !== 'function') return;
  const rutas = await db.Ruta.findAll({
    where: { fkid_repartidor: repartidorId, fecha_ruta: String(fecha).slice(0, 10), baja_logica: false },
    include: [{ association: 'pedidos', include: [{ association: 'pedido' }] }],
  });
  for (const ruta of rutas) {
    for (const parada of ruta.pedidos || []) {
      if (!parada || parada.estado_entrega === 'entregado') continue;
      if (parada.pedido) await encolarAlDiaSiguiente(parada.pedido, fecha);
      if (typeof parada.destroy === 'function') await parada.destroy();
    }
  }
}

module.exports = { diaAnterior, diaSiguiente, encolarAlDiaSiguiente, reencolarNoEntregados, soltarParadasAbiertas };
