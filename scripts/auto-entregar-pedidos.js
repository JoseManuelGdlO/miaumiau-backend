#!/usr/bin/env node

/**
 * Script standalone para auto-entregar pedidos
 * Se puede ejecutar manualmente o configurar con cron del sistema
 * 
 * Ejecutar manualmente:
 *   node scripts/auto-entregar-pedidos.js
 * 
 * Configurar en cron (cada hora):
 *   0 * * * * cd /ruta/al/proyecto && node scripts/auto-entregar-pedidos.js
 */

require('dotenv').config();
const { sequelize } = require('../src/config/database');
const autoEntregarPedidos = require('../src/jobs/autoEntregarPedidos');

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] Iniciando job: Auto-entregar pedidos...`);
    
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida.');
    
    // Ejecutar el job
    const resultado = await autoEntregarPedidos();
    
    console.log(`[${new Date().toISOString()}] Job completado: ${resultado.actualizados} pedido(s) actualizado(s).`);
    
    // Cerrar conexión
    await sequelize.close();
    console.log('✅ Conexión cerrada.');
    
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en job:`, error);
    await sequelize.close();
    process.exit(1);
  }
}

main();

