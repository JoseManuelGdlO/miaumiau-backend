#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🔍 Verificando permisos del super_admin...\n');

try {
  require('dotenv').config();
  const models = require('../src/models');

  (async () => {
    try {
      const superAdmin = await models.Role.findOne({
        where: { nombre: 'super_admin' },
        include: [{
          model: models.Permission,
          as: 'permissions',
          through: { attributes: [] }
        }]
      });
      
      if (superAdmin) {
        console.log(`✅ Super Admin encontrado (ID: ${superAdmin.id})`);
        console.log(`📊 Total permisos asignados: ${superAdmin.permissions.length}`);
        
        // Contar permisos por categoría
        const byCategory = {};
        superAdmin.permissions.forEach(p => {
          if (!byCategory[p.categoria]) byCategory[p.categoria] = [];
          byCategory[p.categoria].push(p.nombre);
        });
        
        console.log('\n📋 Permisos por categoría:');
        Object.keys(byCategory).sort().forEach(cat => {
          console.log(`  ${cat}: ${byCategory[cat].length} permisos`);
        });
        
        // Verificar total de permisos en el sistema
        const totalPermissions = await models.Permission.count({
          where: { baja_logica: false }
        });
        
        console.log(`\n📊 Total permisos en el sistema: ${totalPermissions}`);
        console.log(`📊 Permisos asignados al super_admin: ${superAdmin.permissions.length}`);
        
        if (superAdmin.permissions.length === totalPermissions) {
          console.log('🎉 ¡El super_admin tiene TODOS los permisos!');
        } else {
          console.log('⚠️  El super_admin no tiene todos los permisos');
        }
        
      } else {
        console.log('❌ Super admin no encontrado');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();

} catch (error) {
  console.error('❌ Error inicializando:', error.message);
  process.exit(1);
}
