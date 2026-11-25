const express = require('express');
const { configuraciones } = require('./cache');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, data: configuraciones() });
});

module.exports = router;
