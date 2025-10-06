'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Primero, eliminar la foreign key existente
    try {
      await queryInterface.removeConstraint('rutas', 'rutas_fkid_repartidor_fkey');
    } catch (error) {
      // Si no existe la constraint, continuar
      console.log('Constraint no encontrada, continuando...');
    }

    // Agregar la nueva foreign key que referencia a repartidores
    await queryInterface.addConstraint('rutas', {
      fields: ['fkid_repartidor'],
      type: 'foreign key',
      name: 'rutas_fkid_repartidor_fkey',
      references: {
        table: 'repartidores',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Eliminar la foreign key a repartidores
    await queryInterface.removeConstraint('rutas', 'rutas_fkid_repartidor_fkey');

    // Restaurar la foreign key original a users
    await queryInterface.addConstraint('rutas', {
      fields: ['fkid_repartidor'],
      type: 'foreign key',
      name: 'rutas_fkid_repartidor_fkey',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });
  }
};
