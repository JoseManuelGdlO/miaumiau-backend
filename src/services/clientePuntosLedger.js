const { sequelize, Cliente, ClientePuntosMovimiento } = require('../models');

async function registrarGanado(clienteId, puntos, referencia = null) {
  if (!puntos || puntos < 1) throw new Error('Los puntos deben ser un entero positivo');
  const t = await sequelize.transaction();
  try {
    const cliente = await Cliente.findByPk(clienteId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!cliente) throw new Error('Cliente no encontrado');
    const nuevoSaldo = cliente.puntos_lealtad + puntos;
    cliente.puntos_lealtad = nuevoSaldo;
    await cliente.save({ transaction: t });
    await ClientePuntosMovimiento.create(
      {
        fkid_cliente: clienteId,
        tipo: 'ganado',
        puntos,
        saldo_despues: nuevoSaldo,
        referencia
      },
      { transaction: t }
    );
    await t.commit();
    return { cliente, nuevoSaldo };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function registrarGastado(clienteId, puntos, referencia = null) {
  if (!puntos || puntos < 1) throw new Error('Los puntos deben ser un entero positivo');
  const t = await sequelize.transaction();
  try {
    const cliente = await Cliente.findByPk(clienteId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!cliente) throw new Error('Cliente no encontrado');
    const nuevoSaldo = Math.max(0, cliente.puntos_lealtad - puntos);
    cliente.puntos_lealtad = nuevoSaldo;
    await cliente.save({ transaction: t });
    await ClientePuntosMovimiento.create(
      {
        fkid_cliente: clienteId,
        tipo: 'gastado',
        puntos,
        saldo_despues: nuevoSaldo,
        referencia
      },
      { transaction: t }
    );
    await t.commit();
    return { cliente, nuevoSaldo };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

/**
 * Tras import Excel: actualiza saldo y registra ajuste (delta vs valor anterior).
 */
async function registrarCambioPuntosDesdeImport(clienteId, saldoAnterior, saldoNuevo, referencia = 'import_excel') {
  if (saldoAnterior === saldoNuevo) return null;
  const t = await sequelize.transaction();
  try {
    const cliente = await Cliente.findByPk(clienteId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!cliente) throw new Error('Cliente no encontrado');
    cliente.puntos_lealtad = saldoNuevo;
    await cliente.save({ transaction: t });
    const delta = Math.abs(saldoNuevo - saldoAnterior);
    await ClientePuntosMovimiento.create(
      {
        fkid_cliente: clienteId,
        tipo: 'ajuste',
        puntos: Math.max(delta, 1),
        saldo_despues: saldoNuevo,
        referencia
      },
      { transaction: t }
    );
    await t.commit();
    return cliente;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function resumenDesdeLedger(clienteId) {
  const cliente = await Cliente.findByPk(clienteId, {
    attributes: ['id', 'puntos_lealtad', 'nombre_completo', 'telefono']
  });
  if (!cliente) return null;

  const ganado = await ClientePuntosMovimiento.sum('puntos', {
    where: { fkid_cliente: clienteId, tipo: 'ganado' }
  });
  const gastado = await ClientePuntosMovimiento.sum('puntos', {
    where: { fkid_cliente: clienteId, tipo: 'gastado' }
  });

  return {
    saldo_actual: cliente.puntos_lealtad,
    total_ganado: ganado || 0,
    total_gastado: gastado || 0
  };
}

module.exports = {
  registrarGanado,
  registrarGastado,
  registrarCambioPuntosDesdeImport,
  resumenDesdeLedger
};
