const express = require('express');
const { Op } = require('sequelize');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { resumenEvidencias } = require('../app-repartidor/evidencia');

const router = express.Router();

router.get('/',
  authenticateToken,
  requireSuperAdminOrPermission('ver_flotilla'),
  async (req, res) => {
    try {
      const dia = (valor) => (/^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? String(valor) : null);
      const desde = dia(req.query.desde) || dia(req.query.fecha) || new Date().toISOString().slice(0, 10);
      const hasta = dia(req.query.hasta) || desde;
      const [inicio, fin] = desde <= hasta ? [desde, hasta] : [hasta, desde];
      const db = require('../../models');
      const rows = await db.JornadaRepartidor.findAll({
        where: { fecha: inicio === fin ? inicio : { [Op.between]: [inicio, fin] } },
        include: [{
          association: 'repartidor',
          attributes: ['id', 'nombre_completo', 'fkid_ciudad'],
          include: [{ association: 'ciudad', attributes: ['id', 'nombre'], required: false }],
        }],
        order: [['id', 'ASC']],
      });
      const data = rows.flatMap((row) => {
        const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
        const evidencias = resumenEvidencias(plain.evidencias);
        if (!evidencias.odometro && !evidencias.combustible) return [];
        const nombre = plain.repartidor?.nombre_completo
          || evidencias.combustible?.usuario?.nombre
          || evidencias.odometro?.usuario?.nombre
          || null;
        return [{
          repartidorId: plain.fkid_repartidor,
          nombre,
          ciudadId: plain.repartidor?.fkid_ciudad ?? null,
          ciudad: plain.repartidor?.ciudad?.nombre || null,
          fecha: plain.fecha,
          odometro: evidencias.odometro,
          combustible: evidencias.combustible,
        }];
      });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message || 'No se pudo leer la flotilla' });
    }
  }
);

module.exports = router;
