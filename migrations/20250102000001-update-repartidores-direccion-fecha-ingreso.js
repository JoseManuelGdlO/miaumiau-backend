'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Primero, actualizar registros existentes con direccion NULL a un valor por defecto
    try {
      await queryInterface.sequelize.query(
        "UPDATE repartidores SET direccion = 'Direccion no especificada' WHERE direccion IS NULL OR direccion = ''"
      );
    } catch (error) {
      // Si no hay registros para actualizar, continuar
      console.log('No hay registros para actualizar o error al actualizar:', error.message);
    }

    // Hacer direccion obligatorio (NOT NULL)
    await queryInterface.changeColumn('repartidores', 'direccion', {
      type: Sequelize.TEXT,
      allowNull: false
    });

    // Hacer fecha_ingreso opcional (NULL)
    await queryInterface.changeColumn('repartidores', 'fecha_ingreso', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir cambios: hacer direccion opcional
    await queryInterface.changeColumn('repartidores', 'direccion', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Revertir cambios: hacer fecha_ingreso obligatorio
    await queryInterface.changeColumn('repartidores', 'fecha_ingreso', {
      type: Sequelize.DATEONLY,
      allowNull: false
    });
  }
};

