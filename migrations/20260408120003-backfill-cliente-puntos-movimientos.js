'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO cliente_puntos_movimientos (fkid_cliente, tipo, puntos, saldo_despues, referencia, created_at)
      SELECT id, 'ajuste', puntos_lealtad, puntos_lealtad, 'saldo_inicial', NOW()
      FROM clientes WHERE puntos_lealtad > 0
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM cliente_puntos_movimientos WHERE referencia = 'saldo_inicial'`
    );
  }
};
