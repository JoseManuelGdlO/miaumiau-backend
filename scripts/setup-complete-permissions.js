#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Configurando sistema completo de permisos...\n');

try {
  console.log('📋 Paso 1: Ejecutando seeder de permisos...');
  execSync('npx sequelize-cli db:seed --seed 20241201000022-complete-permissions-seeder.js', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Seeder de permisos ejecutado\n');

  console.log('📋 Paso 2: Asignando TODOS los permisos al super_admin...');
  execSync('node scripts/seed-super-admin-all-permissions.js', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Permisos asignados al super_admin\n');

  console.log('📋 Paso 3: Asignando permisos a otros roles...');
  execSync('node scripts/seed-role-permissions.js', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Permisos asignados a otros roles\n');

  console.log('📋 Paso 4: Actualizando rutas para usar permisos dinámicos...');
  execSync('node scripts/update-all-routes-permissions.js', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Rutas actualizadas\n');

  console.log('🎉 ¡Sistema de permisos configurado completamente!');
  console.log('\n📊 Resumen:');
  console.log('- ✅ Permisos creados en la base de datos');
  console.log('- ✅ Super_admin tiene TODOS los permisos');
  console.log('- ✅ Otros roles tienen permisos específicos');
  console.log('- ✅ Rutas actualizadas para usar verificación dinámica');
  console.log('\n🔒 El sistema ahora usa permisos dinámicos en lugar de roles estáticos');

} catch (error) {
  console.error('\n❌ Error durante la configuración:', error.message);
  console.error('\n💡 Verifica que:');
  console.error('   - Las migraciones estén ejecutadas');
  console.error('   - La base de datos esté configurada correctamente');
  console.error('   - Los archivos de seeders existan');
  process.exit(1);
}
