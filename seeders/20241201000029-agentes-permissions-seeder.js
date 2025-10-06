'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const permissions = [
      // Permisos para gestión de agentes
      {
        nombre: 'ver_agentes',
        descripcion: 'Ver lista de agentes',
        categoria: 'agentes',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_agentes',
        descripcion: 'Crear nuevos agentes',
        categoria: 'agentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_agentes',
        descripcion: 'Editar agentes existentes',
        categoria: 'agentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_agentes',
        descripcion: 'Eliminar agentes',
        categoria: 'agentes',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'configurar_agentes',
        descripcion: 'Configurar prompts y contexto de agentes',
        categoria: 'agentes',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'activar_desactivar_agentes',
        descripcion: 'Activar y desactivar agentes',
        categoria: 'agentes',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'ver_estadisticas_agentes',
        descripcion: 'Ver reportes de rendimiento de agentes',
        categoria: 'agentes',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'administrar_agentes',
        descripcion: 'Administración completa de agentes',
        categoria: 'agentes',
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
      categoria: 'agentes'
    }, {});
  }
};
