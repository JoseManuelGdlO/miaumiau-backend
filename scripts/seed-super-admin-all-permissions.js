#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🚀 Asignando TODOS los permisos al rol super_admin...\n');

try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('No se encontró package.json. Ejecuta este script desde la raíz del backend.');
  }

  require('dotenv').config();

  const models = require('../src/models');
  const { sequelize } = models;

  (async () => {
    const tx = await sequelize.transaction();
    try {
      // Buscar el rol super_admin
      const superAdminRole = await models.Role.findOne({
        where: { nombre: 'super_admin' }
      }, { transaction: tx });

      if (!superAdminRole) {
        throw new Error('No se encontró el rol super_admin en la base de datos');
      }

      console.log(`✅ Rol super_admin encontrado (ID: ${superAdminRole.id})`);

      // Buscar TODOS los permisos activos
      const allPermissions = await models.Permission.findAll({
        where: { 
          baja_logica: false
        }
      }, { transaction: tx });

      if (allPermissions.length === 0) {
        console.log('⚠️  No se encontraron permisos en la base de datos');
        console.log('   Ejecuta primero el seeder de permisos:');
        console.log('   npx sequelize-cli db:seed --seed 20241201000022-complete-permissions-seeder.js');
        return;
      }

      console.log(`✅ Encontrados ${allPermissions.length} permisos en el sistema`);

      // Obtener IDs de todos los permisos
      const allPermissionIds = allPermissions.map(p => p.id);

      // Verificar qué permisos ya tiene asignados
      const existingRolePermissions = await models.RolePermission.findAll({
        where: {
          role_id: superAdminRole.id,
          permission_id: { [models.Sequelize.Op.in]: allPermissionIds }
        }
      }, { transaction: tx });

      const existingPermissionIds = existingRolePermissions.map(rp => rp.permission_id);
      const newPermissionIds = allPermissionIds.filter(id => !existingPermissionIds.includes(id));

      if (newPermissionIds.length === 0) {
        console.log('✅ El rol super_admin ya tiene todos los permisos asignados');
        await tx.commit();
        return;
      }

      // Asignar los permisos faltantes
      const rolePermissionsToCreate = newPermissionIds.map(permissionId => ({
        role_id: superAdminRole.id,
        permission_id: permissionId,
        created_at: new Date(),
        updated_at: new Date()
      }));

      await models.RolePermission.bulkCreate(rolePermissionsToCreate, { transaction: tx });

      console.log(`✅ Asignados ${newPermissionIds.length} permisos al rol super_admin`);
      
      // Mostrar los permisos asignados por categoría
      const newPermissions = allPermissions.filter(p => newPermissionIds.includes(p.id));
      const permissionsByCategory = {};
      
      newPermissions.forEach(permission => {
        if (!permissionsByCategory[permission.categoria]) {
          permissionsByCategory[permission.categoria] = [];
        }
        permissionsByCategory[permission.categoria].push(permission);
      });

      console.log('\n📋 Permisos asignados por categoría:');
      console.log('=====================================');
      
      Object.keys(permissionsByCategory).sort().forEach(category => {
        console.log(`\n🔹 ${category.toUpperCase()}:`);
        permissionsByCategory[category].forEach(permission => {
          console.log(`   - ${permission.nombre} (${permission.tipo})`);
        });
      });

      // Verificar el total de permisos asignados
      const totalAssignedPermissions = await models.RolePermission.count({
        where: { role_id: superAdminRole.id }
      }, { transaction: tx });

      console.log(`\n📊 Total de permisos asignados al super_admin: ${totalAssignedPermissions}`);
      console.log(`📊 Total de permisos en el sistema: ${allPermissions.length}`);

      if (totalAssignedPermissions === allPermissions.length) {
        console.log('🎉 ¡El super_admin ahora tiene TODOS los permisos del sistema!');
      } else {
        console.log('⚠️  El super_admin no tiene todos los permisos. Verifica la configuración.');
      }

      await tx.commit();
      console.log('\n✅ Permisos asignados exitosamente al rol super_admin');
      process.exit(0);
    } catch (error) {
      await tx.rollback();
      console.error('\n❌ Error durante la asignación de permisos:', error.message);
      process.exit(1);
    }
  })();

} catch (error) {
  console.error('\n❌ Error inicializando el script:', error.message);
  console.error('\n💡 Sugerencias:');
  console.error('   - Verifica variables de entorno de DB (DB_HOST, DB_USER, etc.)');
  console.error('   - Ejecuta migraciones y seeders base antes de este script');
  console.error('   - Asegúrate de que existan los permisos en la base de datos');
  process.exit(1);
}
