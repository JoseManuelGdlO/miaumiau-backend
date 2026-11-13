const { Op } = require('sequelize');

const MAX_PARADAS_DIA = 30;
const CUPO_LLENO = `Ese repartidor ya tiene ${MAX_PARADAS_DIA} pedidos hoy`;

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function diaDe(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    return fecha.toISOString().slice(0, 10);
  }
  const texto = String(fecha).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
}

async function contarParadasDelDia(db, { repartidorId, fecha, transaction } = {}) {
  const dia = diaDe(fecha);
  if (typeof db?.RutaPedido?.count !== 'function' || typeof db?.Ruta?.findAll !== 'function' || !repartidorId || !dia) return 0;
  const opts = transaction ? { transaction } : {};
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: Number(repartidorId),
      fecha_ruta: dia,
      baja_logica: false,
      estado: { [Op.ne]: 'cancelada' },
    },
    attributes: ['id'],
    ...opts,
  });
  const ids = rutas.map((row) => row.id);
  if (!ids.length) return 0;
  if (typeof db.RutaPedido?.count === 'function') {
    return db.RutaPedido.count({
      where: { fkid_ruta: { [Op.in]: ids } },
      ...opts,
    });
  }
  return 0;
}

async function exigirCupo(db, opts = {}) {
  const extra = opts.extra == null ? 1 : Number(opts.extra);
  const actual = await contarParadasDelDia(db, opts);
  if (actual + extra > MAX_PARADAS_DIA) fail(409, CUPO_LLENO);
  return actual;
}

async function cuposPorRepartidor(db, ids, fecha) {
  const lista = (ids || []).map(Number).filter((id) => Number.isInteger(id) && id > 0);
  const out = Object.fromEntries(lista.map((id) => [id, 0]));
  const dia = diaDe(fecha);
  if (!lista.length || !dia || typeof db?.Ruta?.findAll !== 'function') return out;
  const rutas = await db.Ruta.findAll({
    where: {
      fkid_repartidor: { [Op.in]: lista },
      fecha_ruta: dia,
      baja_logica: false,
      estado: { [Op.ne]: 'cancelada' },
    },
    attributes: ['id', 'fkid_repartidor'],
  });
  if (!rutas.length || typeof db.RutaPedido?.findAll !== 'function') return out;
  const paradas = await db.RutaPedido.findAll({
    where: { fkid_ruta: { [Op.in]: rutas.map((row) => row.id) } },
    attributes: ['id', 'fkid_ruta'],
  });
  const dueño = Object.fromEntries(rutas.map((row) => [row.id, Number(row.fkid_repartidor)]));
  for (const parada of paradas) {
    const driverId = dueño[parada.fkid_ruta];
    if (driverId) out[driverId] = (out[driverId] || 0) + 1;
  }
  return out;
}

async function idsPedidosDePrueba(db) {
  if (typeof db?.Repartidor?.findAll !== 'function') return [];
  const testers = await db.Repartidor.findAll({
    where: { es_prueba: true },
    attributes: ['id'],
  });
  const ids = testers.map((row) => row.id);
  if (!ids.length || typeof db.Ruta?.findAll !== 'function') return [];
  const rutas = await db.Ruta.findAll({
    where: { fkid_repartidor: { [Op.in]: ids }, baja_logica: false },
    attributes: ['id'],
  });
  const rutaIds = rutas.map((row) => row.id);
  if (!rutaIds.length || typeof db.RutaPedido?.findAll !== 'function') return [];
  const paradas = await db.RutaPedido.findAll({
    where: { fkid_ruta: { [Op.in]: rutaIds } },
    attributes: ['fkid_pedido'],
  });
  return [...new Set(paradas.map((row) => Number(row.fkid_pedido)).filter(Boolean))];
}

module.exports = {
  MAX_PARADAS_DIA,
  CUPO_LLENO,
  diaDe,
  contarParadasDelDia,
  exigirCupo,
  cuposPorRepartidor,
  idsPedidosDePrueba,
};
