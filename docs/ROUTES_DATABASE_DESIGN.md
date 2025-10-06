# 🗺️ Diseño de Base de Datos para Planificación de Rutas

## 📋 **Estructura de Tablas**

### **1. Tabla `rutas`**
```sql
CREATE TABLE rutas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre_ruta VARCHAR(100) NOT NULL,
  fecha_ruta DATE NOT NULL,
  fkid_ciudad INT NOT NULL,
  fkid_repartidor INT NOT NULL,
  estado ENUM('planificada', 'en_progreso', 'completada', 'cancelada') DEFAULT 'planificada',
  total_pedidos INT DEFAULT 0,
  total_entregados INT DEFAULT 0,
  distancia_estimada DECIMAL(10,2) DEFAULT 0.00,
  tiempo_estimado INT DEFAULT 0, -- en minutos
  notas TEXT,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_inicio DATETIME NULL,
  fecha_fin DATETIME NULL,
  baja_logica BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (fkid_ciudad) REFERENCES cities(id),
  FOREIGN KEY (fkid_repartidor) REFERENCES users(id)
);
```

### **2. Tabla `rutas_pedidos` (Tabla Intermedia)**
```sql
CREATE TABLE rutas_pedidos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  fkid_ruta INT NOT NULL,
  fkid_pedido INT NOT NULL,
  orden_entrega INT NOT NULL, -- Orden de entrega (1, 2, 3, etc.)
  estado_entrega ENUM('pendiente', 'en_camino', 'entregado', 'fallido') DEFAULT 'pendiente',
  tiempo_estimado_entrega INT DEFAULT 0, -- Tiempo estimado desde inicio de ruta
  distancia_desde_anterior DECIMAL(10,2) DEFAULT 0.00,
  lat DECIMAL(10,8) NULL, -- Latitud GPS
  lng DECIMAL(11,8) NULL, -- Longitud GPS
  link_ubicacion VARCHAR(500) NULL, -- Link de Google Maps o similar
  notas_entrega TEXT,
  fecha_entrega_real DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (fkid_ruta) REFERENCES rutas(id) ON DELETE CASCADE,
  FOREIGN KEY (fkid_pedido) REFERENCES pedidos(id),
  UNIQUE KEY unique_ruta_pedido (fkid_ruta, fkid_pedido),
  INDEX idx_ruta_orden (fkid_ruta, orden_entrega),
  INDEX idx_coordenadas (lat, lng)
);
```

## 🎯 **Campos Explicados**

### **Tabla `rutas`:**
- **`nombre_ruta`**: Nombre descriptivo de la ruta (ej: "Ruta Centro - Mañana")
- **`fecha_ruta`**: Día específico de la ruta
- **`fkid_ciudad`**: Ciudad donde se realizará la ruta
- **`fkid_repartidor`**: Usuario con rol de repartidor asignado
- **`estado`**: Estado actual de la ruta
- **`total_pedidos`**: Contador de pedidos asignados
- **`total_entregados`**: Contador de pedidos entregados
- **`distancia_estimada`**: Distancia total estimada en km
- **`tiempo_estimado`**: Tiempo total estimado en minutos
- **`fecha_inicio/fecha_fin`**: Timestamps reales de inicio y fin

### **Tabla `rutas_pedidos`:**
- **`orden_entrega`**: Secuencia de entrega (1, 2, 3...)
- **`estado_entrega`**: Estado individual de cada entrega
- **`tiempo_estimado_entrega`**: Tiempo estimado desde inicio de ruta
- **`distancia_desde_anterior`**: Distancia desde la entrega anterior
- **`lat`**: Latitud GPS de la ubicación de entrega
- **`lng`**: Longitud GPS de la ubicación de entrega
- **`link_ubicacion`**: Link de Google Maps o similar para navegación
- **`fecha_entrega_real`**: Timestamp real de entrega

## 🔄 **Flujo de Trabajo**

1. **Planificación**: Seleccionar ciudad, fecha y pedidos
2. **Creación de Ruta**: Crear ruta con repartidor asignado
3. **Asignación de Pedidos**: Agregar pedidos con orden específico
4. **Geolocalización**: Obtener coordenadas GPS de cada dirección
5. **Optimización**: Calcular distancias y tiempos entre ubicaciones
6. **Generación de Links**: Crear enlaces de navegación
7. **Ejecución**: Repartidor sigue la ruta en orden
8. **Seguimiento**: Actualizar estados en tiempo real

## 📊 **Consultas Típicas**

```sql
-- Obtener ruta con pedidos ordenados y coordenadas
SELECT r.*, rp.orden_entrega, rp.lat, rp.lng, rp.link_ubicacion,
       p.numero_pedido, p.direccion_entrega, p.telefono_referencia
FROM rutas r
JOIN rutas_pedidos rp ON r.id = rp.fkid_ruta
JOIN pedidos p ON rp.fkid_pedido = p.id
WHERE r.id = ? AND r.fecha_ruta = ?
ORDER BY rp.orden_entrega;

-- Estadísticas de rutas por repartidor
SELECT u.nombre_completo, COUNT(r.id) as total_rutas,
       SUM(r.total_entregados) as total_entregados,
       AVG(r.tiempo_estimado) as tiempo_promedio
FROM users u
LEFT JOIN rutas r ON u.id = r.fkid_repartidor
WHERE u.rol_id = (SELECT id FROM roles WHERE nombre = 'repartidor')
GROUP BY u.id;

-- Pedidos pendientes de geolocalización
SELECT rp.*, p.direccion_entrega
FROM rutas_pedidos rp
JOIN pedidos p ON rp.fkid_pedido = p.id
WHERE rp.lat IS NULL OR rp.lng IS NULL
AND rp.estado_entrega = 'pendiente';
```

## 🎯 **Permisos Necesarios**

```javascript
// Permisos para gestión de rutas
'ver_rutas' - Ver lista de rutas
'crear_rutas' - Crear nuevas rutas
'editar_rutas' - Editar rutas existentes
'eliminar_rutas' - Eliminar rutas
'asignar_pedidos_rutas' - Asignar pedidos a rutas
'optimizar_rutas' - Optimizar orden de entregas
'geolocalizar_rutas' - Obtener coordenadas GPS
'seguir_rutas' - Seguir ruta asignada (repartidor)
'completar_entregas' - Marcar entregas como completadas
'ver_estadisticas_rutas' - Ver reportes de rutas
```

## 🔧 **Consideraciones Adicionales**

### **Geolocalización:**
- **API de Geocoding**: Para convertir direcciones a coordenadas
- **Validación de Coordenadas**: Verificar que lat/lng sean válidas
- **Caché de Coordenadas**: Evitar consultas repetidas a la misma dirección

### **Optimización de Rutas:**
- **Algoritmo TSP**: Traveling Salesman Problem para optimizar orden
- **Cálculo de Distancias**: Usar fórmula de Haversine o API de Google Maps
- **Tiempo de Tráfico**: Considerar horarios pico y condiciones de tráfico

### **Navegación:**
- **Links de Google Maps**: Generar automáticamente con coordenadas
- **Integración con Apps**: Waze, Google Maps, Apple Maps
- **Navegación Offline**: Para áreas con poca cobertura

### **Seguimiento en Tiempo Real:**
- **GPS del Repartidor**: Ubicación actual del repartidor
- **Estimación de Llegada**: Tiempo estimado a cada entrega
- **Notificaciones**: Alertas cuando se complete una entrega

### **Reportes y Analytics:**
- **Eficiencia por Repartidor**: Tiempo promedio, distancia recorrida
- **Análisis de Rutas**: Rutas más eficientes, áreas problemáticas
- **Métricas de Entrega**: Tasa de éxito, tiempo promedio por entrega

## 📱 **Casos de Uso del Frontend**

### **Para Administradores:**
- Crear y planificar rutas
- Asignar repartidores
- Ver estadísticas y reportes
- Optimizar rutas automáticamente

### **Para Repartidores:**
- Ver ruta asignada con orden de entregas
- Navegar a cada ubicación
- Marcar entregas como completadas
- Reportar problemas de entrega

### **Para Supervisores:**
- Monitorear rutas en tiempo real
- Ver progreso de entregas
- Reasignar pedidos si es necesario
- Generar reportes de eficiencia
