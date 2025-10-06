'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mascotas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      edad: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      genero: {
        type: Sequelize.ENUM('macho', 'hembra'),
        allowNull: true
      },
      raza: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      producto_preferido: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      puntos_lealtad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      notas_especiales: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      fkid_cliente: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'clientes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Agregar índices
    await queryInterface.addIndex('mascotas', ['fkid_cliente']);
    await queryInterface.addIndex('mascotas', ['genero']);
    await queryInterface.addIndex('mascotas', ['raza']);
    await queryInterface.addIndex('mascotas', ['isActive']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('mascotas');
  }
};
