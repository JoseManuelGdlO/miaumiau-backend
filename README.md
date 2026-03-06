# Miaumiau Backend API

API backend desarrollada con Express.js, Sequelize ORM y MySQL para el proyecto Miaumiau.

## 🚀 Características

- **Express.js** - Framework web rápido y minimalista
- **Sequelize** - ORM para Node.js con soporte para MySQL
- **MySQL** - Base de datos relacional
- **JWT** - Autenticación basada en tokens
- **Bcrypt** - Encriptación de contraseñas
- **Express Validator** - Validación de datos
- **Helmet** - Seguridad HTTP
- **CORS** - Configuración de CORS
- **Rate Limiting** - Limitación de requests
- **Morgan** - Logging de requests

## 📁 Estructura del Proyecto

```
src/
├── app.js                 # Aplicación principal
├── config/
│   └── database.js        # Configuración de la base de datos
├── middleware/
│   ├── auth.js           # Middleware de autenticación
│   ├── errorHandler.js   # Manejo de errores
│   └── notFound.js       # Middleware 404
├── models/
│   ├── index.js          # Índice de modelos
│   └── User.js           # Modelo de Usuario
├── modules/
│   └── auth/             # Módulo de autenticación
│       ├── controller.js # Controlador de autenticación
│       └── routes.js     # Rutas de autenticación
└── utils/
    ├── jwt.js            # Utilidades JWT
    └── validation.js     # Validaciones
```

## 🛠️ Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd miaumiau-back
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp env.local .env
   ```
   Edita el archivo `.env` con tus configuraciones.

4. **Levantar la base de datos MySQL**
   ```bash
   docker-compose up -d
   ```

5. **Ejecutar la aplicación**
   ```bash
   # Desarrollo
   npm run dev
   
   # Producción
   npm start
   ```

## 🔧 Variables de Entorno

```env
# Servidor
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000

# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_NAME=miaumiau_db
DB_USER=miaumiau_user
DB_PASSWORD=miaumiau_password

# JWT
JWT_SECRET=tu_jwt_secret_muy_seguro
JWT_EXPIRE=24h
JWT_REFRESH_SECRET=tu_jwt_refresh_secret_muy_seguro
JWT_REFRESH_EXPIRE=7d

# URLs públicas (para imágenes y catálogo Meta)
# En EasyPanel usa la URL base del backend (ej. https://api.tudominio.com)
BASE_URL=
# Alternativa: PUBLIC_URL
# PUBLIC_URL=
```

## 📚 API Endpoints

### Autenticación

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Registrar usuario | No |
| POST | `/api/auth/login` | Iniciar sesión | No |
| POST | `/api/auth/refresh-token` | Renovar token | No |
| GET | `/api/auth/profile` | Obtener perfil | Sí |
| PUT | `/api/auth/profile` | Actualizar perfil | Sí |
| PUT | `/api/auth/change-password` | Cambiar contraseña | Sí |
| POST | `/api/auth/logout` | Cerrar sesión | Sí |

### Health Check

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado de la API |

## 🔐 Autenticación

La API utiliza JWT (JSON Web Tokens) para la autenticación. Incluye el token en el header:

```
Authorization: Bearer <token>
```

## 📝 Ejemplos de Uso

### Registro de Usuario
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuario123",
    "email": "usuario@example.com",
    "password": "Password123",
    "firstName": "Juan",
    "lastName": "Pérez"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "Password123"
  }'
```

### Obtener Perfil
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <token>"
```

## 🧪 Testing

```bash
npm test
```

## 🚢 Despliegue en EasyPanel

- **Volumen para imágenes**: Monta un volumen persistente en el servicio del backend para que las imágenes de productos y combos no se pierdan al reiniciar. Ejemplo: ruta en el host `./data/uploads` → ruta en el contenedor `/app/uploads` (o la ruta donde la app escribe `uploads/`).
- **Variable BASE_URL**: Configura la variable de entorno `BASE_URL` con la URL pública del backend (ej. `https://intelekia-miaumiau-back.vvggha.easypanel.host`). Así las URLs de las imágenes y del CSV de catálogo serán absolutas para Meta y el frontend.
- **Catálogo Meta**: La URL del feed CSV por ciudad es `GET /catalogo/:slug/catalogo.csv` (pública, sin auth). Ejemplo: `https://tu-backend.com/catalogo/DURANGO/catalogo.csv`. Cada ciudad debe tener el campo `slug` configurado (ej. DURANGO, CDMX).

## 🐳 Docker

### Levantar solo MySQL
```bash
docker-compose up -d
```

### Construir imagen de la aplicación
```bash
docker build -t miaumiau-backend .
```

## 📋 Scripts Disponibles

- `npm start` - Iniciar en producción
- `npm run dev` - Iniciar en desarrollo con nodemon
- `npm test` - Ejecutar tests
- `npm run migrate` - Ejecutar migraciones
- `npm run seed` - Ejecutar seeders

## 🔒 Seguridad

- Contraseñas encriptadas con bcrypt
- JWT para autenticación
- Rate limiting
- Helmet para headers de seguridad
- Validación de datos de entrada
- CORS configurado

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.