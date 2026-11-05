const { Op } = require('sequelize');
const { MAX_PARADAS_DIA, idsPedidosDePrueba } = require('../rutas/cupo');

const ABIERTOS = ['pendiente', 'confirmado', 'en_preparacion', 'en_camino'];
const DRIVERS_ACTIVOS = ['activo', 'disponible', 'ocupado', 'en_ruta'];

function fechaMx(date) {
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}-${date.getFullYear()}`;
}

function fechaHablada(clave) {
  return String(clave || '').replace(/-/g, '/');
}

function mensajeSaturado(pedida, proxima) {
  if (proxima) {
    return `Por ahora el ${fechaHablada(pedida)} está saturado. La fecha más cercana para entrega es el ${fechaHablada(proxima)}.`;
  }
  return `Por ahora el ${fechaHablada(pedida)} está saturado. En los próximos días no hay entrega disponible.`;
}

function horasDelDia(ciudad, diaSemana) {
  let horaInicio = 8;
  let horaFin = 18;
  if (ciudad && typeof ciudad.getHorasEntregaParaDia === 'function') {
    const horas = ciudad.getHorasEntregaParaDia(diaSemana);
    if (horas && typeof horas.inicio === 'number' && typeof horas.fin === 'number') {
      horaInicio = horas.inicio;
      horaFin = horas.fin;
    }
  }
  return { horaInicio, horaFin };
}

async function capacidadDiaria(db, ciudadId) {
  if (typeof db?.Repartidor?.count !== 'function') return MAX_PARADAS_DIA;
  const where = {
    baja_logica: false,
    es_prueba: false,
    estado: { [Op.in]: DRIVERS_ACTIVOS },
  };
  if (ciudadId) where.fkid_ciudad = ciudadId;
  const n = await db.Repartidor.count({ where });
  return Math.max(1, Number(n) || 0) * MAX_PARADAS_DIA;
}

async function pedidosDelDia(db, { ciudadId, inicio, fin, excluirIds }) {
  const where = {
    fecha_entrega_estimada: { [Op.between]: [inicio, fin] },
    estado: { [Op.in]: ABIERTOS },
    baja_logica: false,
  };
  if (ciudadId) where.fkid_ciudad = ciudadId;
  if (excluirIds?.length) where.id = { [Op.notIn]: excluirIds };
  return db.Pedido.count({ where });
}

async function listarDisponibilidad(db, { desde, ciudad, ciudadId, dias = 7, excluirIds } = {}) {
  const diasTrabajo = ciudad && typeof ciudad.getDiasTrabajo === 'function'
    ? ciudad.getDiasTrabajo()
    : [0, 1, 2, 3, 4, 5, 6];
  const capacidad = await capacidadDiaria(db, ciudadId);
  const prueba = excluirIds || await idsPedidosDePrueba(db);
  const out = [];
  for (let i = 0; i < dias; i += 1) {
    const fecha = new Date(desde);
    fecha.setDate(fecha.getDate() + i);
    const clave = fechaMx(fecha);
    if (!diasTrabajo.includes(fecha.getDay())) {
      out.push({
        fecha: clave,
        disponible: false,
        pedidos: 0,
        capacidad,
        motivo_no_disponible: 'Día no laboral',
      });
      continue;
    }
    const { horaInicio, horaFin } = horasDelDia(ciudad, fecha.getDay());
    const inicio = new Date(fecha);
    inicio.setHours(horaInicio, 0, 0, 0);
    const fin = new Date(fecha);
    fin.setHours(horaFin, 0, 0, 0);
    const pedidos = await pedidosDelDia(db, { ciudadId, inicio, fin, excluirIds: prueba });
    const saturado = pedidos >= capacidad;
    out.push({
      fecha: clave,
      disponible: !saturado,
      pedidos,
      capacidad,
      ...(saturado ? { motivo_no_disponible: 'Saturado' } : {}),
    });
  }
  const proxima = out.find((dia) => dia.disponible)?.fecha || null;
  return {
    dias: out.map((dia) => (
      dia.motivo_no_disponible === 'Saturado'
        ? { ...dia, mensaje: mensajeSaturado(dia.fecha, proxima) }
        : dia
    )),
    proxima_fecha: proxima,
    capacidad,
  };
}

function claveDe(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return fechaMx(d);
}

async function exigirFechaLibre(db, { ciudad, ciudadId, fecha, dias = 14 } = {}) {
  const pedida = claveDe(fecha);
  if (!pedida) return { ok: true };
  const desde = fecha instanceof Date ? new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) : new Date(fecha);
  const { dias: ventana, proxima_fecha } = await listarDisponibilidad(db, {
    desde,
    ciudad,
    ciudadId,
    dias,
  });
  const hoy = ventana[0];
  if (hoy?.disponible) return { ok: true };
  return {
    ok: false,
    status: 409,
    message: mensajeSaturado(pedida, proxima_fecha),
    proxima_fecha,
  };
}

module.exports = {
  mensajeSaturado,
  capacidadDiaria,
  listarDisponibilidad,
  exigirFechaLibre,
  fechaMx,
};
