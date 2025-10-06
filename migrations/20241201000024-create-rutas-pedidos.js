'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rutas_pedidos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_ruta: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'rutas',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID de la ruta'
      },
      fkid_pedido: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'pedidos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'ID del pedido'
      },
      orden_entrega: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Orden de entrega (1, 2, 3, etc.)'
      },
      estado_entrega: {
        type: Sequelize.ENUM('pendiente', 'en_camino', 'entregado', 'fallido'),
        allowNull: false,
        defaultValue: 'pendiente',
        comment: 'Estado individual de cada entrega'
      },
      tiempo_estimado_entrega: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Tiempo estimado desde inicio de ruta en minutos'
      },
      distancia_desde_anterior: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Distancia desde la entrega anterior en km'
      },
      lat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: 'Latitud GPS de la ubicación de entrega'
      },
      lng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: 'Longitud GPS de la ubicación de entrega'
      },
      link_ubicacion: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Link de Google Maps o similar para navegación'
      },
      notas_entrega: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notas específicas para esta entrega'
      },
      fecha_entrega_real: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp real de entrega'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Agregar índices
    await queryInterface.addIndex('rutas_pedidos', ['fkid_ruta']);
    await queryInterface.addIndex('rutas_pedidos', ['fkid_pedido']);
    await queryInterface.addIndex('rutas_pedidos', ['estado_entrega']);
    await queryInterface.addIndex('rutas_pedidos', ['lat', 'lng']);
    await queryInterface.addIndex('rutas_pedidos', ['fkid_ruta', 'orden_entrega'], {
      name: 'idx_ruta_orden'
    });

    // Agregar constraint único para evitar duplicados
    await queryInterface.addConstraint('rutas_pedidos', {
      fields: ['fkid_ruta', 'fkid_pedido'],
      type: 'unique',
      name: 'unique_ruta_pedido'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('rutas_pedidos');
  }
};
