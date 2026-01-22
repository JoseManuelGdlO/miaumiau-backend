const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../../middleware/auth');
const mapsController = require('./controller');

const router = express.Router();

// Middleware de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }
  next();
};

// Validaciones
const geocodeValidation = [
  body('address')
    .notEmpty()
    .withMessage('La dirección es requerida')
    .isLength({ min: 5, max: 500 })
    .withMessage('La dirección debe tener entre 5 y 500 caracteres'),
  body('estado')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El estado debe tener entre 2 y 100 caracteres'),
  body('ciudad')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('La ciudad debe tener entre 2 y 100 caracteres'),
  handleValidationErrors
];

const distanceMatrixValidation = [
  body('origins')
    .isArray({ min: 1, max: 25 })
    .withMessage('Los orígenes deben ser un array con entre 1 y 25 elementos'),
  body('origins.*.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('La latitud debe ser un número entre -90 y 90'),
  body('origins.*.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('La longitud debe ser un número entre -180 y 180'),
  body('destinations')
    .isArray({ min: 1, max: 25 })
    .withMessage('Los destinos deben ser un array con entre 1 y 25 elementos'),
  body('destinations.*.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('La latitud debe ser un número entre -90 y 90'),
  body('destinations.*.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('La longitud debe ser un número entre -180 y 180'),
  handleValidationErrors
];

const geocodeMultipleValidation = [
  body('addresses')
    .isArray({ min: 1, max: 50 })
    .withMessage('Las direcciones deben ser un array con entre 1 y 50 elementos'),
  body('addresses.*')
    .custom((value) => {
      // Puede ser string o objeto con address, estado, ciudad
      if (typeof value === 'string') {
        return value.length >= 5 && value.length <= 500;
      }
      if (typeof value === 'object' && value.address) {
        return value.address.length >= 5 && value.address.length <= 500;
      }
      return false;
    })
    .withMessage('Cada dirección debe ser un string o un objeto con address (5-500 caracteres)'),
  handleValidationErrors
];

// Rutas protegidas
router.post('/geocode',
  authenticateToken,
  geocodeValidation,
  mapsController.geocodeAddress
);

router.post('/geocode-multiple',
  authenticateToken,
  geocodeMultipleValidation,
  mapsController.geocodeMultipleAddresses
);

router.post('/distance-matrix',
  authenticateToken,
  distanceMatrixValidation,
  mapsController.calculateDistanceMatrix
);

module.exports = router;

