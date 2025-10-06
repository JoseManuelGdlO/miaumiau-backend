'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const permissions = [
      // Permisos para gestión de repartidores
      {
        nombre: 'ver_repartidores',
        descripcion: 'Ver lista de repartidores',
        categoria: 'repartidores',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_repartidores',
        descripcion: 'Crear nuevos repartidores',
        categoria: 'repartidores',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_repartidores',
        descripcion: 'Editar repartidores existentes',
        categoria: 'repartidores',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_repartidores',
        descripcion: 'Eliminar repartidores',
        categoria: 'repartidores',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'activar_desactivar_repartidores',
        descripcion: 'Activar y desactivar repartidores',
        categoria: 'repartidores',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'asignar_rutas_repartidores',
        descripcion: 'Asignar rutas a repartidores',
        categoria: 'repartidores',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'ver_estadisticas_repartidores',
        descripcion: 'Ver reportes de rendimiento de repartidores',
        categoria: 'repartidores',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'administrar_repartidores',
        descripcion: 'Administración completa de repartidores',
        categoria: 'repartidores',
        tipo: 'administracion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('permissions', permissions, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', {
      categoria: 'repartidores'
    }, {});
  }
};
