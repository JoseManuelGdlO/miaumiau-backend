'use strict';

const METODOS = ['efectivo', 'tarjeta', 'transferencia', 'pago_movil', 'mixto'];
const ANTES = ['efectivo', 'tarjeta', 'transferencia', 'pago_movil'];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE pedidos MODIFY COLUMN metodo_pago ENUM(${METODOS.map((e) => `'${e}'`).join(',')}) NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE pedidos SET metodo_pago = 'efectivo' WHERE metodo_pago = 'mixto'"
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE pedidos MODIFY COLUMN metodo_pago ENUM(${ANTES.map((e) => `'${e}'`).join(',')}) NULL`
    );
  },
};
