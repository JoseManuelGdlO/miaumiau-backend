# Jobs Programados

Este directorio contiene los jobs (tareas programadas) que se ejecutan automáticamente en el sistema.

## Auto-entregar Pedidos

### Descripción
Job que verifica cada hora si hay pedidos cuya fecha de entrega estimada ya pasó y los marca automáticamente como "entregado".

### Funcionamiento
- **Frecuencia**: Cada hora (al minuto 0 de cada hora)
- **Condiciones para marcar como entregado**:
  - El pedido tiene `fecha_entrega_estimada` definida
  - La fecha de entrega ya pasó **en la zona horaria de la ciudad del pedido**
  - El estado es "pendiente"
  - El pedido no está dado de baja (`baja_logica = false`)

### Zona Horaria
- El job considera la zona horaria de cada ciudad al comparar fechas
- Cada ciudad debe tener un campo `timezone` con el formato IANA (ej: `America/Mexico_City`, `America/Bogota`)
- Si una ciudad no tiene zona horaria definida, se usa `America/Mexico_City` por defecto
- La comparación se hace en la zona horaria local de cada ciudad, no en UTC

### Ejecución Automática
El job se ejecuta automáticamente cuando el servidor está corriendo, configurado en `src/app.js` usando `node-cron`.

### Ejecución Manual
Puedes ejecutar el job manualmente de dos formas:

1. **Usando npm script**:
   ```bash
   npm run job:auto-entregar
   ```

2. **Directamente con Node**:
   ```bash
   node scripts/auto-entregar-pedidos.js
   ```

### Configuración con Cron del Sistema
Si prefieres usar el cron del sistema en lugar de node-cron, puedes agregar esta línea a tu crontab:

```bash
0 * * * * cd /ruta/completa/al/proyecto/miaumiau-backend && node scripts/auto-entregar-pedidos.js >> /var/log/miaumiau-jobs.log 2>&1
```

Esto ejecutará el job cada hora y guardará los logs en `/var/log/miaumiau-jobs.log`.

### Logs
El job registra:
- Cuántos pedidos fueron actualizados
- Los IDs y números de pedido actualizados
- Errores si ocurren

Los logs aparecen en la consola del servidor cuando se ejecuta automáticamente.

