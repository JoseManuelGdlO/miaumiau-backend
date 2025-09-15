const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const { sequelize } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Importar rutas
const authRoutes = require('./modules/auth/routes');
const userRoutes = require('./modules/users/routes');
const permissionRoutes = require('./modules/permissions/routes');
const roleRoutes = require('./modules/roles/routes');
const cityRoutes = require('./modules/cities/routes');
const promotionRoutes = require('./modules/promotions/routes');
const pesoRoutes = require('./modules/pesos/routes');
const categoriaProductoRoutes = require('./modules/categorias-producto/routes');
const clienteRoutes = require('./modules/clientes/routes');
const proveedorRoutes = require('./modules/proveedores/routes');
const inventarioRoutes = require('./modules/inventarios/routes');
const conversacionRoutes = require('./modules/conversaciones/routes');
const conversacionChatRoutes = require('./modules/conversaciones-chat/routes');
const conversacionLogRoutes = require('./modules/conversaciones-logs/routes');
const pedidoRoutes = require('./modules/pedidos/routes');
const productoPedidoRoutes = require('./modules/productos-pedido/routes');

const app = express();

// Middlewares de seguridad
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
});
app.use(limiter);

// CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://192.168.1.64:8080',
    'http://192.168.1.64:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/pesos', pesoRoutes);
app.use('/api/categorias-producto', categoriaProductoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/inventarios', inventarioRoutes);
app.use('/api/conversaciones', conversacionRoutes);
app.use('/api/conversaciones-chat', conversacionChatRoutes);
app.use('/api/conversaciones-logs', conversacionLogRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/productos-pedido', productoPedidoRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Miaumiau API está funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});


// Middlewares de error
app.use(notFound);
app.use(errorHandler);

// Inicializar base de datos y servidor
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente.');
    
    // Sincronizar modelos (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      // await sequelize.sync({ alter: true });
      console.log('✅ Modelos sincronizados con la base de datos.');
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
