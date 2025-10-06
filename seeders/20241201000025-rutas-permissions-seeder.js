'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const permissions = [
      // Permisos para gestión de rutas
      {
        nombre: 'ver_rutas',
        descripcion: 'Ver lista de rutas',
        categoria: 'rutas',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_rutas',
        descripcion: 'Crear nuevas rutas',
        categoria: 'rutas',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_rutas',
        descripcion: 'Editar rutas existentes',
        categoria: 'rutas',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_rutas',
        descripcion: 'Eliminar rutas',
        categoria: 'rutas',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'asignar_pedidos_rutas',
        descripcion: 'Asignar pedidos a rutas',
        categoria: 'rutas',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'optimizar_rutas',
        descripcion: 'Optimizar orden de entregas',
        categoria: 'rutas',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'geolocalizar_rutas',
        descripcion: 'Obtener coordenadas GPS',
        categoria: 'rutas',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'seguir_rutas',
        descripcion: 'Seguir ruta asignada (repartidor)',
        categoria: 'rutas',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'completar_entregas',
        descripcion: 'Marcar entregas como completadas',
        categoria: 'rutas',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'ver_estadisticas_rutas',
        descripcion: 'Ver reportes de rutas',
        categoria: 'rutas',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'administrar_rutas',
        descripcion: 'Administración completa de rutas',
        categoria: 'rutas',
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
      categoria: 'rutas'
    }, {});
  }
};
