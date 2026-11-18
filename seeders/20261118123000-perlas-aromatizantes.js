'use strict';

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM categorias_producto WHERE nombre = 'Perlas aromatizantes' LIMIT 1",
    );
    if (rows.length) return;
    await queryInterface.bulkInsert('categorias_producto', [{
      nombre: 'Perlas aromatizantes',
      descripcion: 'Perlas aromatizantes para mascotas',
      baja_logica: false,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('categorias_producto', { nombre: 'Perlas aromatizantes' });
  },
};
