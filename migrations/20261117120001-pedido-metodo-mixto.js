'use strict';

const METODOS = ['efectivo', 'tarjeta', 'transferencia', 'pago_movil', 'mixto'];
const ANTES = ['efectivo', 'tarjeta', 'transferencia', 'pago_movil'];

async function tipoMetodoPago(queryInterface) {
  const [rows] = await queryInterface.sequelize.query("SHOW COLUMNS FROM pedidos LIKE 'metodo_pago'");
  return rows[0]?.Type || '';
}

module.exports = {
  async up(queryInterface) {
    const tipo = await tipoMetodoPago(queryInterface);
    if (tipo.includes("'mixto'")) return;
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
