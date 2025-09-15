'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si ya existen permisos para evitar duplicados
    const existingPermissions = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as count FROM permissions',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Solo insertar si no hay permisos existentes
    if (existingPermissions[0].count > 0) {
      console.log('Permisos ya existen, saltando inserción');
      return;
    }
    
    const permissions = [
      // Permisos de Usuario
      {
        nombre: 'ver_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite ver la lista de usuarios',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite crear nuevos usuarios',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite editar información de usuarios',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite eliminar usuarios del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'administrar_usuarios',
        categoria: 'usuarios',
        descripcion: 'Permite administrar completamente los usuarios',
        tipo: 'administracion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // Permisos de Permisos
      {
        nombre: 'ver_permisos',
        categoria: 'permisos',
        descripcion: 'Permite ver la lista de permisos',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'crear_permisos',
        categoria: 'permisos',
        descripcion: 'Permite crear nuevos permisos',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'editar_permisos',
        categoria: 'permisos',
        descripcion: 'Permite editar permisos existentes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'eliminar_permisos',
        categoria: 'permisos',
        descripcion: 'Permite eliminar permisos del sistema',
        tipo: 'eliminacion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // Permisos de Sistema
      {
        nombre: 'ver_logs',
        categoria: 'sistema',
        descripcion: 'Permite ver los logs del sistema',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'configurar_sistema',
        categoria: 'sistema',
        descripcion: 'Permite configurar parámetros del sistema',
        tipo: 'administracion',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'backup_sistema',
        categoria: 'sistema',
        descripcion: 'Permite realizar backups del sistema',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'restore_sistema',
        categoria: 'sistema',
        descripcion: 'Permite restaurar backups del sistema',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },

      // Permisos de Reportes
      {
        nombre: 'ver_reportes',
        categoria: 'reportes',
        descripcion: 'Permite ver reportes del sistema',
        tipo: 'lectura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'generar_reportes',
        categoria: 'reportes',
        descripcion: 'Permite generar nuevos reportes',
        tipo: 'escritura',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        nombre: 'exportar_reportes',
        categoria: 'reportes',
        descripcion: 'Permite exportar reportes en diferentes formatos',
        tipo: 'especial',
        baja_logica: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Insertar permisos usando queryInterface
    await queryInterface.bulkInsert('permissions', permissions);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', null, {});
  }
};
