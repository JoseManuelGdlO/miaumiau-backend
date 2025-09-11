'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Primero, eliminar la tabla users existente si existe
    await queryInterface.dropTable('users');

    // Crear la nueva tabla users con la estructura actualizada
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre_completo: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      correo_electronico: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      rol_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      ciudad_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      contrasena: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      lastLogin: {
        type: Sequelize.DATE,
        allowNull: true
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

    // Crear claves foráneas
    await queryInterface.addConstraint('users', {
      fields: ['rol_id'],
      type: 'foreign key',
      name: 'fk_users_rol_id',
      references: {
        table: 'roles',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('users', {
      fields: ['ciudad_id'],
      type: 'foreign key',
      name: 'fk_users_ciudad_id',
      references: {
        table: 'cities',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    // Crear índices
    await queryInterface.addIndex('users', ['rol_id'], { name: 'idx_users_rol_id' });
    await queryInterface.addIndex('users', ['ciudad_id'], { name: 'idx_users_ciudad_id' });
    await queryInterface.addIndex('users', ['correo_electronico'], { unique: true, name: 'idx_users_email_unique' });
  },

  async down(queryInterface, Sequelize) {
    // Eliminar la tabla users
    await queryInterface.dropTable('users');
  }
};
