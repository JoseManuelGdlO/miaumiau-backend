'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rutas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre_ruta: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nombre descriptivo de la ruta'
      },
      fecha_ruta: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Día específico de la ruta'
      },
      fkid_ciudad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Ciudad donde se realizará la ruta'
      },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Usuario repartidor asignado'
      },
      estado: {
        type: Sequelize.ENUM('planificada', 'en_progreso', 'completada', 'cancelada'),
        allowNull: false,
        defaultValue: 'planificada',
        comment: 'Estado actual de la ruta'
      },
      total_pedidos: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Contador de pedidos asignados'
      },
      total_entregados: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Contador de pedidos entregados'
      },
      distancia_estimada: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Distancia total estimada en km'
      },
      tiempo_estimado: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Tiempo total estimado en minutos'
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notas adicionales sobre la ruta'
      },
      fecha_creacion: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'Fecha de creación de la ruta'
      },
      fecha_inicio: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp real de inicio de ruta'
      },
      fecha_fin: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp real de fin de ruta'
      },
      baja_logica: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si la ruta está eliminada lógicamente'
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
    await queryInterface.addIndex('rutas', ['fecha_ruta']);
    await queryInterface.addIndex('rutas', ['fkid_ciudad']);
    await queryInterface.addIndex('rutas', ['fkid_repartidor']);
    await queryInterface.addIndex('rutas', ['estado']);
    await queryInterface.addIndex('rutas', ['baja_logica']);
    await queryInterface.addIndex('rutas', ['fecha_ruta', 'fkid_ciudad']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('rutas');
  }
};
