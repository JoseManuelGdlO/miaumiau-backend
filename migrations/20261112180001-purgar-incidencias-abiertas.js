'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM notificaciones
      WHERE leida = 0
        AND JSON_UNQUOTE(JSON_EXTRACT(datos, '$.tipo')) = 'soporte'
    `);
  },

  async down() {
    // shortcut: las incidencias abiertas se borran a propósito, no hay restauración
  },
};
