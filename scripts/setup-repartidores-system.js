#!/usr/bin/env node

/**
 * Script para configurar el sistema de repartidores
 * Ejecuta migraciones y seeders necesarios
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚚 Configurando sistema de repartidores...\n');

try {
  // 1. Ejecutar migraciones
  console.log('📋 Ejecutando migraciones...');
  execSync('npx sequelize-cli db:migrate --migrations-path migrations --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Migraciones completadas\n');

  // 2. Ejecutar seeder de permisos de repartidores
  console.log('🔐 Creando permisos de repartidores...');
  execSync('npx sequelize-cli db:seed --seed 20241201000033-repartidores-permissions-seeder.js --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Permisos de repartidores creados\n');

  // 3. Asignar permisos a roles
  console.log('👥 Asignando permisos de repartidores a roles...');
  execSync('npx sequelize-cli db:seed --seed 20241201000034-repartidores-role-permissions-seeder.js --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Permisos asignados a roles\n');

  // 4. Crear repartidores de ejemplo
  console.log('🚚 Creando repartidores de ejemplo...');
  execSync('npx sequelize-cli db:seed --seed 20241201000035-repartidores-sample-data-seeder.js --config config/database.js', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Repartidores de ejemplo creados\n');

  console.log('🎉 Sistema de repartidores configurado exitosamente!');
  console.log('\n📋 Repartidores creados:');
  console.log('1. Juan Carlos Pérez (REP-001) - Moto - Disponible');
  console.log('2. María González (REP-002) - Bicicleta - Disponible');
  console.log('3. Carlos Rodríguez (REP-003) - Auto - Disponible');
  console.log('4. Ana Martínez (REP-004) - Moto - En Ruta');
  console.log('5. Luis Hernández (REP-005) - Camioneta - Ocupado');
  
  console.log('\n🔧 Próximos pasos:');
  console.log('1. Crear controladores y rutas para gestión de rutas');
  console.log('2. Implementar algoritmo de asignación automática');
  console.log('3. Integrar con sistema de geolocalización');
  console.log('4. Crear interfaz de seguimiento en tiempo real');

} catch (error) {
  console.error('❌ Error configurando el sistema de repartidores:', error.message);
  process.exit(1);
}
