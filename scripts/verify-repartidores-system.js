#!/usr/bin/env node

const { sequelize } = require('../src/config/database');

async function verifySystem() {
  try {
    console.log('🔍 Verificando sistema de repartidores...\n');

    // Verificar tabla repartidores
    const [repartidores] = await sequelize.query('SELECT COUNT(*) as total FROM repartidores');
    console.log('✅ Tabla repartidores:', repartidores[0].total, 'registros');

    // Verificar permisos de repartidores
    const [permisos] = await sequelize.query('SELECT COUNT(*) as total FROM permissions WHERE categoria = "repartidores"');
    console.log('✅ Permisos de repartidores:', permisos[0].total, 'permisos');

    // Verificar asignaciones de permisos
    const [asignaciones] = await sequelize.query(`
      SELECT COUNT(*) as total 
      FROM role_permissions rp 
      INNER JOIN permissions p ON rp.permission_id = p.id 
      WHERE p.categoria = "repartidores"
    `);
    console.log('✅ Asignaciones de permisos:', asignaciones[0].total, 'asignaciones');

    // Mostrar repartidores creados
    const [repartidoresList] = await sequelize.query(`
      SELECT codigo_repartidor, nombre_completo, tipo_vehiculo, estado, calificacion_promedio 
      FROM repartidores 
      WHERE baja_logica = false
      ORDER BY codigo_repartidor
    `);
    
    console.log('\n🚚 Repartidores creados:');
    repartidoresList.forEach(repartidor => {
      console.log(`  ${repartidor.codigo_repartidor} - ${repartidor.nombre_completo} (${repartidor.tipo_vehiculo}) - ${repartidor.estado} - ⭐${repartidor.calificacion_promedio}`);
    });

    // Mostrar permisos creados
    const [permisosList] = await sequelize.query(`
      SELECT nombre, descripcion, tipo 
      FROM permissions 
      WHERE categoria = "repartidores" 
      ORDER BY nombre
    `);
    
    console.log('\n📋 Permisos de repartidores creados:');
    permisosList.forEach(permiso => {
      console.log(`  - ${permiso.nombre}: ${permiso.descripcion} (${permiso.tipo})`);
    });

    // Verificar relación con ciudades
    const [repartidoresConCiudad] = await sequelize.query(`
      SELECT r.codigo_repartidor, r.nombre_completo, c.nombre as ciudad
      FROM repartidores r
      INNER JOIN cities c ON r.fkid_ciudad = c.id
      WHERE r.baja_logica = false
      LIMIT 3
    `);
    
    console.log('\n🏙️ Relación con ciudades:');
    repartidoresConCiudad.forEach(rep => {
      console.log(`  ${rep.codigo_repartidor} - ${rep.nombre_completo} (${rep.ciudad})`);
    });

    console.log('\n🎉 Sistema de repartidores configurado correctamente!');
    
  } catch (error) {
    console.error('❌ Error verificando el sistema:', error.message);
  } finally {
    await sequelize.close();
  }
}

verifySystem();
