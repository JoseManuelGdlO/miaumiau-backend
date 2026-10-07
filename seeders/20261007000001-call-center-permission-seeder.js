'use strict';

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE nombre = 'operar_call_center' LIMIT 1"
    );
    if (rows.length) return;
    await queryInterface.bulkInsert('permissions', [{
      nombre: 'operar_call_center',
      categoria: 'call_center',
      descripcion: 'Operar la cola de la app y los pedidos del día',
      tipo: 'escritura',
      baja_logica: false,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permissions', { nombre: 'operar_call_center' });
  },
};
