const { Logger } = require('../utils/logger');

const log = new Logger('Error');

const UNIQUE_FIELD_MESSAGES = {
  codigo_repartidor: 'El código de repartidor ya está en uso',
  email: 'El correo electrónico ya está registrado',
  documento_identidad: 'El documento de identidad ya está registrado',
  telefono: 'El teléfono ya está registrado'
};

const uniqueConstraintMessage = (err) => {
  const field = err.errors?.[0]?.path || Object.keys(err.fields || {})[0];
  if (field && UNIQUE_FIELD_MESSAGES[field]) {
    return UNIQUE_FIELD_MESSAGES[field];
  }
  return 'Ya existe un registro con esos datos';
};

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  const isExpectedClientError = err.name === 'SequelizeValidationError'
    || err.name === 'SequelizeUniqueConstraintError';

  // Los conflictos de validación no incluyen el SQL en el log
  const requestMeta = { method: req.method, path: req.originalUrl || req.path };

  if (isExpectedClientError) {
    const detail = err.name === 'SequelizeUniqueConstraintError'
      ? uniqueConstraintMessage(err)
      : err.errors?.map(item => item.message).join(', ');
    log.warn(detail || err.message, requestMeta);
  } else {
    log.error(err.message || 'Error interno', {
      ...requestMeta,
      name: err.name,
      stack: err.stack
    });
  }

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
    error = {
      message: uniqueConstraintMessage(err),
      statusCode: 409
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
