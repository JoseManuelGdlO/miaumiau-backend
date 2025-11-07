'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Modificar la columna ciudad_id para permitir NULL
    await queryInterface.changeColumn('users', 'ciudad_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'cities',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir: hacer ciudad_id NOT NULL nuevamente
    // Nota: Esto puede fallar si hay registros con ciudad_id NULL
    await queryInterface.changeColumn('users', 'ciudad_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'cities',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  }
};

