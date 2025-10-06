#!/usr/bin/env node

/**
 * Script para configurar el sistema de agentes de chatbot
 * Ejecuta migraciones y seeders necesarios
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🤖 Configurando sistema de agentes de chatbot...\n');

try {
  // 1. Ejecutar migraciones
  console.log('📋 Ejecutando migraciones...');
  execSync('npx sequelize-cli db:migrate --migrations-path migrations --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Migraciones completadas\n');

  // 2. Ejecutar seeder de permisos de agentes
  console.log('🔐 Creando permisos de agentes...');
  execSync('npx sequelize-cli db:seed --seed 20241201000029-agentes-permissions-seeder.js --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Permisos de agentes creados\n');

  // 3. Asignar permisos a roles
  console.log('👥 Asignando permisos de agentes a roles...');
  execSync('npx sequelize-cli db:seed --seed 20241201000030-agentes-role-permissions-seeder.js --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Permisos asignados a roles\n');

  // 4. Crear agentes de ejemplo
  console.log('🤖 Creando agentes de ejemplo...');
  execSync('npx sequelize-cli db:seed --seed 20241201000031-agentes-sample-data-seeder.js --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Agentes de ejemplo creados\n');

  console.log('🎉 Sistema de agentes configurado exitosamente!');
  console.log('\n📋 Agentes creados:');
  console.log('1. Agente Ventas - Especializado en ventas premium');
  console.log('2. Agente Soporte - Resolución de problemas');
  console.log('3. Agente Información - Información de productos');
  console.log('4. Agente Veterinario - Consejos de salud animal');
  console.log('5. Agente General - Atención general y derivación');
  
  console.log('\n🔧 Próximos pasos:');
  console.log('1. Montar las rutas de agentes en app.js');
  console.log('2. Implementar lógica de selección de agentes');
  console.log('3. Integrar con el sistema de conversaciones');
  console.log('4. Crear interfaz de administración de agentes');

} catch (error) {
  console.error('❌ Error configurando el sistema de agentes:', error.message);
  process.exit(1);
}
