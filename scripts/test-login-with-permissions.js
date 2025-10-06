#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🧪 Probando login con permisos en el token...\n');

try {
  require('dotenv').config();
  const models = require('../src/models');

  (async () => {
    try {
      // Buscar el usuario super_admin
      const superAdmin = await models.User.findOne({
        where: { correo_electronico: 'admin@miaumiau.com' },
        include: [
          {
            model: models.Role,
            as: 'rol',
            include: [
              {
                model: models.Permission,
                as: 'permissions',
                through: { attributes: [] },
                where: { baja_logica: false },
                required: false
              }
            ]
          }
        ]
      });

      if (!superAdmin) {
        console.log('❌ Usuario super_admin no encontrado');
        return;
      }

      console.log(`✅ Usuario encontrado: ${superAdmin.nombre_completo}`);
      console.log(`📧 Email: ${superAdmin.correo_electronico}`);
      console.log(`🔑 Rol: ${superAdmin.rol ? superAdmin.rol.nombre : 'Sin rol'}`);
      
      if (superAdmin.rol && superAdmin.rol.permissions) {
        console.log(`📊 Permisos asignados: ${superAdmin.rol.permissions.length}`);
        
        // Mostrar algunos permisos como ejemplo
        const samplePermissions = superAdmin.rol.permissions.slice(0, 5);
        console.log('🔹 Ejemplos de permisos:');
        samplePermissions.forEach(p => {
          console.log(`   - ${p.nombre} (${p.categoria})`);
        });
        
        if (superAdmin.rol.permissions.length > 5) {
          console.log(`   ... y ${superAdmin.rol.permissions.length - 5} más`);
        }
      }

      // Simular el proceso de login
      console.log('\n🔐 Simulando proceso de login...');
      
      // Obtener permisos del usuario
      let userPermissions = [];
      if (superAdmin.rol && superAdmin.rol.permissions) {
        userPermissions = superAdmin.rol.permissions.map(p => p.nombre);
      }

      // Si es super_admin, agregar indicador de acceso total
      if (superAdmin.rol && superAdmin.rol.nombre === 'super_admin') {
        userPermissions.push('*');
      }

      console.log(`✅ Permisos que se incluirán en el token: ${userPermissions.length}`);
      console.log(`🎯 Incluye acceso total (super_admin): ${userPermissions.includes('*') ? 'Sí' : 'No'}`);

      // Simular generación de token (sin JWT real)
      const tokenPayload = {
        userId: superAdmin.id,
        email: superAdmin.correo_electronico,
        role: superAdmin.rol ? superAdmin.rol.nombre : null,
        permissions: userPermissions
      };

      console.log('\n📋 Payload del token:');
      console.log(`   - userId: ${tokenPayload.userId}`);
      console.log(`   - email: ${tokenPayload.email}`);
      console.log(`   - role: ${tokenPayload.role}`);
      console.log(`   - permissions: [${userPermissions.length} permisos]`);

      console.log('\n🎉 ¡El sistema está listo para incluir permisos en el token!');
      console.log('\n💡 Para probar el login real:');
      console.log('   POST /api/auth/login');
      console.log('   Body: { "correo_electronico": "admin@miaumiau.com", "contrasena": "admin123" }');
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();

} catch (error) {
  console.error('❌ Error inicializando:', error.message);
  process.exit(1);
}
