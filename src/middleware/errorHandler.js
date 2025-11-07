const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  console.error(err);

  // Error de validación de Sequelize
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(error => error.message).join(', ');
    error = {
      message,
      statusCode: 400
    };
  }

  // Error de duplicado de Sequelize
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = 'Recurso duplicado';
    error = {
      message,
      statusCode: 400
    };
  }

  // Error de conexión a base de datos
  if (err.name === 'SequelizeConnectionError') {
    const message = 'Error de conexión a la base de datos';
    error = {
      message,
      statusCode: 500
    };
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = {
      message,
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = {
      message,
      statusCode: 401
    };
  }

  const statusCode = error.statusCode || 500;
  
  // Asegurar que siempre se envíe una respuesta JSON válida
  res.status(statusCode).json({
    success: false,
    error: error.message || 'Error interno del servidor',
    message: error.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
