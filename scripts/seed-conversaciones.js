#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🚀 Iniciando seed de conversaciones, chats y logs...\n');

try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('No se encontró package.json. Ejecuta este script desde la raíz del backend.');
  }

  require('dotenv').config();

  const models = require('../src/models');
  const { sequelize } = models;

  const now = new Date();
  const toDateOnly = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const toTimeOnly = (d) => d.toTimeString().slice(0, 8); // HH:MM:SS

  (async () => {
    const tx = await sequelize.transaction();
    try {
      // Conversación 1
      const conv1 = await models.Conversacion.create({
        from: 'whatsapp:+51999999999',
        status: 'activa',
        id_cliente: null,
        tipo_usuario: 'cliente',
        baja_logica: false
      }, { transaction: tx });

      // Logs conv1
      const baseDate1 = new Date(now.getTime() - 1000 * 60 * 30); // hace 30 min
      await models.ConversacionLog.bulkCreate([
        {
          fkid_conversacion: conv1.id,
          fecha: toDateOnly(baseDate1),
          hora: toTimeOnly(baseDate1),
          data: { evento: 'inicio_conversacion' },
          tipo_log: 'inicio',
          nivel: 'info',
          descripcion: 'Conversación iniciada por el usuario'
        },
        {
          fkid_conversacion: conv1.id,
          fecha: toDateOnly(new Date(baseDate1.getTime() + 5 * 60 * 1000)),
          hora: toTimeOnly(new Date(baseDate1.getTime() + 5 * 60 * 1000)),
          data: { mensaje: 'Usuario envía primer mensaje' },
          tipo_log: 'mensaje',
          nivel: 'info',
          descripcion: 'Primer mensaje del usuario'
        }
      ], { transaction: tx });

      // Chats conv1
      await models.ConversacionChat.bulkCreate([
        {
          fkid_conversacion: conv1.id,
          fecha: toDateOnly(baseDate1),
          hora: toTimeOnly(new Date(baseDate1.getTime() + 1 * 60 * 1000)),
          from: 'usuario',
          mensaje: 'Hola, quisiera información sobre productos para gatos',
          tipo_mensaje: 'texto',
          metadata: null,
          leido: false,
          baja_logica: false
        },
        {
          fkid_conversacion: conv1.id,
          fecha: toDateOnly(baseDate1),
          hora: toTimeOnly(new Date(baseDate1.getTime() + 2 * 60 * 1000)),
          from: 'bot',
          mensaje: '¡Hola! ¿Qué tipo de productos buscas? (alimento, arena, juguetes)',
          tipo_mensaje: 'texto',
          metadata: { flow: 'saludo' },
          leido: true,
          baja_logica: false
        }
      ], { transaction: tx });

      // Conversación 2
      const conv2 = await models.Conversacion.create({
        from: 'web:contacto',
        status: 'en_espera',
        id_cliente: null,
        tipo_usuario: 'cliente',
        baja_logica: false
      }, { transaction: tx });

      // Logs conv2
      const baseDate2 = new Date(now.getTime() - 1000 * 60 * 10); // hace 10 min
      await models.ConversacionLog.bulkCreate([
        {
          fkid_conversacion: conv2.id,
          fecha: toDateOnly(baseDate2),
          hora: toTimeOnly(baseDate2),
          data: { evento: 'inicio_conversacion' },
          tipo_log: 'inicio',
          nivel: 'info',
          descripcion: 'Conversación creada desde formulario web'
        },
        {
          fkid_conversacion: conv2.id,
          fecha: toDateOnly(new Date(baseDate2.getTime() + 3 * 60 * 1000)),
          hora: toTimeOnly(new Date(baseDate2.getTime() + 3 * 60 * 1000)),
          data: { estado: 'en_espera', razon: 'pendiente de agente' },
          tipo_log: 'sistema',
          nivel: 'info',
          descripcion: 'Conversación en espera de asignación'
        }
      ], { transaction: tx });

      // Chats conv2
      await models.ConversacionChat.bulkCreate([
        {
          fkid_conversacion: conv2.id,
          fecha: toDateOnly(baseDate2),
          hora: toTimeOnly(new Date(baseDate2.getTime() + 1 * 60 * 1000)),
          from: 'usuario',
          mensaje: 'Buenas, necesito cambiar la arena de mi gato. ¿Recomendaciones?',
          tipo_mensaje: 'texto',
          metadata: null,
          leido: false,
          baja_logica: false
        },
        {
          fkid_conversacion: conv2.id,
          fecha: toDateOnly(baseDate2),
          hora: toTimeOnly(new Date(baseDate2.getTime() + 4 * 60 * 1000)),
          from: 'sistema',
          mensaje: 'Un agente te atenderá en breve. Gracias por tu paciencia.',
          tipo_mensaje: 'texto',
          metadata: { queue: 'soporte' },
          leido: true,
          baja_logica: false
        }
      ], { transaction: tx });

      await tx.commit();
      console.log('\n✅ Seed completado: Se crearon 2 conversaciones con sus chats y logs.');
      process.exit(0);
    } catch (error) {
      await tx.rollback();
      console.error('\n❌ Error durante el seed de conversaciones:', error.message);
      process.exit(1);
    }
  })();

} catch (error) {
  console.error('\n❌ Error inicializando el script:', error.message);
  console.error('\n💡 Sugerencias:');
  console.error('   - Verifica variables de entorno de DB (DB_HOST, DB_USER, etc.)');
  console.error('   - Ejecuta migraciones y seeders base antes de este script');
  console.error('   - Revisa las tablas: conversaciones, conversaciones_chat, conversaciones_logs');
  process.exit(1);
}


