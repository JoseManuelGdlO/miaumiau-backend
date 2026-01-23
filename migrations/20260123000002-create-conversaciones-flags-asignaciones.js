'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversaciones_flags_asignaciones', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fkid_conversacion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'conversaciones',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fkid_flag: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'conversaciones_flags',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.addIndex('conversaciones_flags_asignaciones', ['fkid_conversacion'], { name: 'idx_flags_asignaciones_conversacion' });
    await queryInterface.addIndex('conversaciones_flags_asignaciones', ['fkid_flag'], { name: 'idx_flags_asignaciones_flag' });
    await queryInterface.addIndex('conversaciones_flags_asignaciones', ['fkid_conversacion', 'fkid_flag'], { 
      unique: true,
      name: 'unique_conversacion_flag' 
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversaciones_flags_asignaciones');
  }
};
