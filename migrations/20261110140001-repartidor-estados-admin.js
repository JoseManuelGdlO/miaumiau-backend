'use strict';

const ESTADOS = [
  'activo',
  'inactivo',
  'ocupado',
  'disponible',
  'en_ruta',
  'no_disponible',
  'permiso_economico',
  'incapacitado',
  'baja',
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE repartidores MODIFY COLUMN estado ENUM(${ESTADOS.map((e) => `'${e}'`).join(',')}) NOT NULL DEFAULT 'disponible'`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE repartidores SET estado = 'inactivo' WHERE estado IN ('no_disponible','permiso_economico','incapacitado','baja')`
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE repartidores MODIFY COLUMN estado ENUM('activo','inactivo','ocupado','disponible','en_ruta') NOT NULL DEFAULT 'disponible'"
    );
  },
};
