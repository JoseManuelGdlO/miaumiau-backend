const { Op } = require('sequelize');

function diaAnterior(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

async function reencolarNoEntregados(deps = {}) {
  const fecha = String(deps.fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || typeof deps.Pedido?.findAll !== 'function') return 0;
  const ayer = diaAnterior(fecha);
  const rows = await deps.Pedido.findAll({
    where: {
      baja_logica: false,
      estado: 'no_entregado',
      fecha_entrega_estimada: {
        [Op.between]: [new Date(`${ayer}T00:00:00.000Z`), new Date(`${ayer}T23:59:59.999Z`)],
      },
    },
  });
  let moved = 0;
  for (const row of rows) {
    if (row.estado && row.estado !== 'no_entregado') continue;
    const nota = 'Volvió a la cola: no se entregó el día anterior.';
    const notas = String(row.notas || '').includes(nota)
      ? row.notas
      : `${row.notas ? `${row.notas}\n` : ''}${nota}`.slice(0, 1000);
    const data = {
      fecha_entrega_estimada: new Date(`${fecha}T12:00:00.000Z`),
      estado: 'confirmado',
      notas,
    };
    if (typeof row.update === 'function') await row.update(data);
    else Object.assign(row, data);
    moved += 1;
  }
  return moved;
}

module.exports = { diaAnterior, reencolarNoEntregados };
