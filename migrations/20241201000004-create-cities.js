'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cities', {
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
      departamento: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      direccion_operaciones: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      estado_inicial: {
        type: Sequelize.ENUM('activa', 'inactiva', 'en_construccion', 'mantenimiento', 'suspendida'),
        allowNull: false,
        defaultValue: 'activa'
      },
      numero_zonas_entrega: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      area_cobertura: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      tiempo_promedio_entrega: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Tiempo en minutos'
      },
      horario_atencion: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      manager: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      email_contacto: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      notas_adicionales: {
        type: Sequelize.TEXT,
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

    // Crear índices
    await queryInterface.addIndex('cities', ['departamento'], { name: 'idx_cities_departamento' });
    await queryInterface.addIndex('cities', ['estado_inicial'], { name: 'idx_cities_estado_inicial' });
    await queryInterface.addIndex('cities', ['baja_logica'], { name: 'idx_cities_baja_logica' });
    await queryInterface.addIndex('cities', ['nombre', 'departamento'], { unique: true, name: 'idx_cities_unique' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cities');
  }
};
