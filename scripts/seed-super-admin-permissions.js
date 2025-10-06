#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🚀 Iniciando asignación de permisos al rol super_admin...\n');

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

      // Buscar todos los permisos de la categoría 'permisos'
      const permissionPermissions = await models.Permission.findAll({
        where: { 
          categoria: 'permisos',
          baja_logica: false
        }
      }, { transaction: tx });

      if (permissionPermissions.length === 0) {
        console.log('⚠️  No se encontraron permisos de la categoría "permisos"');
        console.log('   Ejecuta primero el seeder de permisos: npm run seed:permissions');
        return;
      }

      console.log(`✅ Encontrados ${permissionPermissions.length} permisos de la categoría "permisos"`);

      // Obtener IDs de los permisos
      const permissionIds = permissionPermissions.map(p => p.id);

      // Verificar qué permisos ya tiene asignados
      const existingRolePermissions = await models.RolePermission.findAll({
        where: {
          role_id: superAdminRole.id,
          permission_id: { [models.Sequelize.Op.in]: permissionIds }
        }
      }, { transaction: tx });

      const existingPermissionIds = existingRolePermissions.map(rp => rp.permission_id);
      const newPermissionIds = permissionIds.filter(id => !existingPermissionIds.includes(id));

      if (newPermissionIds.length === 0) {
        console.log('✅ El rol super_admin ya tiene todos los permisos de permisos asignados');
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

      console.log(`✅ Asignados ${newPermissionIds.length} permisos al rol super_admin:`);
      
      // Mostrar los permisos asignados
      const newPermissions = permissionPermissions.filter(p => newPermissionIds.includes(p.id));
      newPermissions.forEach(permission => {
        console.log(`   - ${permission.nombre} (${permission.tipo})`);
      });

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
  console.error('   - Asegúrate de que existan los permisos de la categoría "permisos"');
  process.exit(1);
}
