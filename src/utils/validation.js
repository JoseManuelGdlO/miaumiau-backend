const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array()
    });
  }
  next();
};

// Validaciones para registro
const validateRegister = [
  body('nombre_completo')
    .isLength({ min: 2, max: 150 })
    .withMessage('El nombre completo debe tener entre 2 y 150 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre completo solo puede contener letras y espacios'),
  
  body('correo_electronico')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  
  body('contrasena')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una letra minúscula, una mayúscula y un número'),
  
  body('rol_id')
    .isInt({ min: 1 })
    .withMessage('El rol debe ser un ID válido'),
  
  body('ciudad_id')
    .isInt({ min: 1 })
    .withMessage('La ciudad debe ser un ID válido'),
  
  handleValidationErrors
];

// Validaciones para login
const validateLogin = [
  body('correo_electronico')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  
  body('contrasena')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
  
  handleValidationErrors
];

// Validaciones para cambio de contraseña
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La nueva contraseña debe contener al menos una letra minúscula, una mayúscula y un número'),
  
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
  handleValidationErrors
};
