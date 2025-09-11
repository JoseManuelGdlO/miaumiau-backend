# Scripts de Inicialización

Este directorio contiene scripts SQL que se ejecutarán automáticamente cuando se cree el contenedor MySQL por primera vez.

## Uso

1. Coloca tus archivos `.sql` en este directorio
2. Los scripts se ejecutarán en orden alfabético
3. Solo se ejecutan una vez, cuando se inicializa la base de datos

## Ejemplo

Puedes crear un archivo `01-create-tables.sql` con tus tablas iniciales:

```sql
-- Crear tabla de ejemplo
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
