# Scripts de Administración

Este directorio contiene scripts personalizados para la administración del sistema Miaumiau.

## Scripts Disponibles

### seed-admin.js

Script para crear un usuario administrador del sistema.

**Uso:**
```bash
# Opción 1: Usando npm script (recomendado)
npm run seed:admin

# Opción 2: Ejecutando directamente el script
node scripts/seed-admin.js

# Opción 3: Como ejecutable (si tiene permisos)
./scripts/seed-admin.js
```

**Qué hace:**
- Crea un usuario administrador con rol `super_admin`
- Email: `admin@miaumiau.com`
- Contraseña: `Admin123!`
- Verifica que existan los roles y ciudades necesarios
- Evita duplicados si el usuario ya existe

**Requisitos previos:**
- Base de datos configurada y migraciones ejecutadas
- Seeders de roles y ciudades ejecutados
- Sequelize CLI instalado

**Notas de seguridad:**
- ⚠️ **IMPORTANTE**: Cambia la contraseña después del primer login
- El usuario se crea con el rol de mayor privilegio (`super_admin`)
- La contraseña se encripta automáticamente usando bcrypt

## Comandos Útiles

```bash
# Ejecutar todas las migraciones
npm run migrate

# Ejecutar todos los seeders
npm run seed

# Ejecutar solo el seeder del administrador
npm run seed:admin

# Deshacer todas las migraciones
npm run migrate:undo

# Deshacer todos los seeders
npm run seed:undo
```
