#!/usr/bin/env node

/**
 * Script para configurar el sistema de planificación de rutas
 * Ejecuta migraciones y seeders necesarios
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Configurando sistema de planificación de rutas...\n');

try {
  // 1. Ejecutar migraciones
  console.log('📋 Ejecutando migraciones...');
  execSync('npx sequelize-cli db:migrate --migrations-path migrations --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Migraciones completadas\n');

  // 2. Ejecutar seeder de permisos de rutas
  console.log('🔐 Creando permisos de rutas...');
  execSync('npx sequelize-cli db:seed --seed 20241201000025-rutas-permissions-seeder.js --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Permisos de rutas creados\n');

  // 3. Asignar permisos a roles
  console.log('👥 Asignando permisos de rutas a roles...');
  execSync('npx sequelize-cli db:seed --seed 20241201000026-rutas-role-permissions-seeder.js --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Permisos asignados a roles\n');

  console.log('🎉 Sistema de planificación de rutas configurado exitosamente!');
  console.log('\n📋 Próximos pasos:');
  console.log('1. Crear controladores y rutas para gestión de rutas');
  console.log('2. Implementar algoritmo de optimización de rutas');
  console.log('3. Integrar API de geolocalización');
  console.log('4. Crear interfaz de usuario para repartidores');

} catch (error) {
  console.error('❌ Error configurando el sistema de rutas:', error.message);
  process.exit(1);
}
