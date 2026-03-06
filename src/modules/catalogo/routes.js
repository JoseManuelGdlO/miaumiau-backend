const express = require('express');
const router = express.Router();
const catalogoController = require('./controller');

// Ruta pública: GET /catalogo/:ciudadSlug/catalogo.csv (sin autenticación, para Meta)
router.get('/:ciudadSlug/catalogo.csv', catalogoController.getCatalogByCitySlug);

module.exports = router;
