'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('clientes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre_completo: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true
      },
      fkid_ciudad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      canal_contacto: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      direccion_entrega: {
        type: Sequelize.TEXT,
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
    await queryInterface.addIndex('clientes', ['email'], {
      unique: true,
      where: {
        email: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    await queryInterface.addIndex('clientes', ['telefono']);
    await queryInterface.addIndex('clientes', ['fkid_ciudad']);
    await queryInterface.addIndex('clientes', ['isActive']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('clientes');
  }
};
