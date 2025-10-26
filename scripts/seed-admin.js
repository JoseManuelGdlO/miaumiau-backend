#!/usr/bin/env node

/**
 * Script para crear un usuario administrador
 * Este script ejecuta solo el seeder del usuario administrador
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando creación de usuario administrador...\n');

try {
  // Verificar que estamos en el directorio correcto
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const fs = require('fs');
  
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('No se encontró package.json. Asegúrate de ejecutar este script desde la raíz del proyecto backend.');
  }

  // Ejecutar solo el seeder del administrador
  const seederFile = '20241201000019-admin-user-seeder.js';
  const command = `npx sequelize-cli db:seed --seed ${seederFile}`;
  
  console.log(`📝 Ejecutando comando: ${command}\n`);
  
  execSync(command, { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ ¡Usuario administrador creado exitosamente!');
  console.log('\n📋 Credenciales de acceso:');
  console.log('   Email: admin@miaumiau.com');
  console.log('   Contraseña: Admin123!');
  console.log('\n⚠️  IMPORTANTE: Cambia la contraseña después del primer login por seguridad.');
  
} catch (error) {
  console.error('\n❌ Error al crear el usuario administrador:');
  console.error(error.message);
  
  if (error.message.includes('ENOENT')) {
    console.error('\n💡 Sugerencias:');
    console.error('   - Asegúrate de tener sequelize-cli instalado: npm install -g sequelize-cli');
    console.error('   - Verifica que la base de datos esté configurada correctamente');
    console.error('   - Ejecuta las migraciones primero: npm run migrate');
  }
  
  process.exit(1);
}

