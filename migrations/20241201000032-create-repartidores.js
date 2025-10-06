'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('repartidores', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      codigo_repartidor: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'Código único del repartidor'
      },
      nombre_completo: {
        type: Sequelize.STRING(150),
        allowNull: false,
        comment: 'Nombre completo del repartidor'
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Número de teléfono principal'
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'Email de contacto'
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
        comment: 'Ciudad donde opera el repartidor'
      },
      fkid_usuario: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Referencia opcional a users si es usuario del sistema'
      },
      tipo_vehiculo: {
        type: Sequelize.ENUM('moto', 'bicicleta', 'auto', 'camioneta', 'caminando'),
        allowNull: false,
        defaultValue: 'moto',
        comment: 'Tipo de vehículo que usa'
      },
      capacidad_carga: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Capacidad máxima de carga en kg'
      },
      estado: {
        type: Sequelize.ENUM('activo', 'inactivo', 'ocupado', 'disponible', 'en_ruta'),
        allowNull: false,
        defaultValue: 'disponible',
        comment: 'Estado actual del repartidor'
      },
      zona_cobertura: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Coordenadas de la zona que cubre'
      },
      horario_trabajo: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Horarios de trabajo'
      },
      tarifa_base: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Tarifa base por entrega'
      },
      comision_porcentaje: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Porcentaje de comisión'
      },
      fecha_ingreso: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Fecha de ingreso a la empresa'
      },
      fecha_nacimiento: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Fecha de nacimiento'
      },
      direccion: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Dirección de residencia'
      },
      documento_identidad: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Número de documento de identidad'
      },
      licencia_conducir: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Número de licencia de conducir'
      },
      seguro_vehiculo: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Información del seguro del vehículo'
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notas adicionales'
      },
      calificacion_promedio: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Calificación promedio (0-5)'
      },
      total_entregas: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de entregas realizadas'
      },
      total_km_recorridos: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total de kilómetros recorridos'
      },
      fecha_ultima_entrega: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de la última entrega'
      },
      baja_logica: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si el repartidor está eliminado lógicamente'
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
    await queryInterface.addIndex('repartidores', ['codigo_repartidor']);
    await queryInterface.addIndex('repartidores', ['fkid_ciudad']);
    await queryInterface.addIndex('repartidores', ['fkid_usuario']);
    await queryInterface.addIndex('repartidores', ['estado']);
    await queryInterface.addIndex('repartidores', ['tipo_vehiculo']);
    await queryInterface.addIndex('repartidores', ['baja_logica']);
    await queryInterface.addIndex('repartidores', ['estado', 'fkid_ciudad']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('repartidores');
  }
};
