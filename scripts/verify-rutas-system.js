#!/usr/bin/env node

const { sequelize } = require('../src/config/database');

async function verifySystem() {
  try {
    console.log('🔍 Verificando sistema de rutas...\n');

    // Verificar tabla rutas
    const [rutas] = await sequelize.query('SELECT COUNT(*) as total FROM rutas');
    console.log('✅ Tabla rutas:', rutas[0].total, 'registros');

    // Verificar tabla rutas_pedidos
    const [rutasPedidos] = await sequelize.query('SELECT COUNT(*) as total FROM rutas_pedidos');
    console.log('✅ Tabla rutas_pedidos:', rutasPedidos[0].total, 'registros');

    // Verificar permisos de rutas
    const [permisos] = await sequelize.query('SELECT COUNT(*) as total FROM permissions WHERE categoria = "rutas"');
    console.log('✅ Permisos de rutas:', permisos[0].total, 'permisos');

    // Verificar asignaciones de permisos
    const [asignaciones] = await sequelize.query(`
      SELECT COUNT(*) as total 
      FROM role_permissions rp 
      INNER JOIN permissions p ON rp.permission_id = p.id 
      WHERE p.categoria = "rutas"
    `);
    console.log('✅ Asignaciones de permisos:', asignaciones[0].total, 'asignaciones');

    // Mostrar permisos creados
    const [permisosList] = await sequelize.query(`
      SELECT nombre, descripcion, tipo 
      FROM permissions 
      WHERE categoria = "rutas" 
      ORDER BY nombre
    `);
    
    console.log('\n📋 Permisos de rutas creados:');
    permisosList.forEach(permiso => {
      console.log(`  - ${permiso.nombre}: ${permiso.descripcion} (${permiso.tipo})`);
    });

    console.log('\n🎉 Sistema de rutas configurado correctamente!');
    
  } catch (error) {
    console.error('❌ Error verificando el sistema:', error.message);
  } finally {
    await sequelize.close();
  }
}

verifySystem();
