'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      codigo: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tipo_promocion: {
        type: Sequelize.ENUM('porcentaje', 'monto_fijo', 'envio_gratis', 'descuento_especial'),
        allowNull: false,
        defaultValue: 'porcentaje'
      },
      valor_descuento: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      fecha_inicio: {
        type: Sequelize.DATE,
        allowNull: false
      },
      fecha_fin: {
        type: Sequelize.DATE,
        allowNull: false
      },
      limite_uso: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      compra_minima: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      descuento_maximo: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      baja_logica: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Crear índices esenciales
    await queryInterface.addIndex('promotions', ['baja_logica'], { name: 'idx_promotions_baja_logica' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('promotions');
  }
};
