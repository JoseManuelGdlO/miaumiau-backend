#!/usr/bin/env node

const { sequelize } = require('../src/config/database');

async function verifySystem() {
  try {
    console.log('🔍 Verificando sistema de agentes...\n');

    // Verificar tabla agentes
    const [agentes] = await sequelize.query('SELECT COUNT(*) as total FROM agentes');
    console.log('✅ Tabla agentes:', agentes[0].total, 'registros');

    // Verificar tabla agentes_conversaciones
    const [agentesConversaciones] = await sequelize.query('SELECT COUNT(*) as total FROM agentes_conversaciones');
    console.log('✅ Tabla agentes_conversaciones:', agentesConversaciones[0].total, 'registros');

    // Verificar permisos de agentes
    const [permisos] = await sequelize.query('SELECT COUNT(*) as total FROM permissions WHERE categoria = "agentes"');
    console.log('✅ Permisos de agentes:', permisos[0].total, 'permisos');

    // Verificar asignaciones de permisos
    const [asignaciones] = await sequelize.query(`
      SELECT COUNT(*) as total 
      FROM role_permissions rp 
      INNER JOIN permissions p ON rp.permission_id = p.id 
      WHERE p.categoria = "agentes"
    `);
    console.log('✅ Asignaciones de permisos:', asignaciones[0].total, 'asignaciones');

    // Mostrar agentes creados
    const [agentesList] = await sequelize.query(`
      SELECT nombre, especialidad, estado, orden_prioridad 
      FROM agentes 
      WHERE baja_logica = false
      ORDER BY orden_prioridad
    `);
    
    console.log('\n🤖 Agentes creados:');
    agentesList.forEach(agente => {
      console.log(`  ${agente.orden_prioridad}. ${agente.nombre} - ${agente.especialidad} (${agente.estado})`);
    });

    // Mostrar permisos creados
    const [permisosList] = await sequelize.query(`
      SELECT nombre, descripcion, tipo 
      FROM permissions 
      WHERE categoria = "agentes" 
      ORDER BY nombre
    `);
    
    console.log('\n📋 Permisos de agentes creados:');
    permisosList.forEach(permiso => {
      console.log(`  - ${permiso.nombre}: ${permiso.descripcion} (${permiso.tipo})`);
    });

    console.log('\n🎉 Sistema de agentes configurado correctamente!');
    
  } catch (error) {
    console.error('❌ Error verificando el sistema:', error.message);
  } finally {
    await sequelize.close();
  }
}

verifySystem();
