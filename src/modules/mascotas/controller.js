const { Mascota, Cliente } = require('../../models');
const { Op } = require('sequelize');

class MascotaController {
  // Obtener todas las mascotas
  async getAllMascotas(req, res, next) {
    try {
      const { 
        activos = 'true', 
        cliente_id, 
        genero,
        raza,
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.is_active = true;
      } else if (activos === 'false') {
        whereClause.is_active = false;
      }
      
      // Filtrar por cliente
      if (cliente_id) {
        whereClause.fkid_cliente = cliente_id;
      }

      // Filtrar por género
      if (genero) {
        whereClause.genero = genero;
      }

      // Filtrar por raza
      if (raza) {
        whereClause.raza = raza;
      }

      // Búsqueda por nombre
      if (search) {
        whereClause.nombre = { [Op.like]: `%${search}%` };
      }

      const offset = (page - 1) * limit;

      const { count, rows: mascotas } = await Mascota.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'telefono', 'email']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          mascotas,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener una mascota por ID
  async getMascotaById(req, res, next) {
    try {
      const { id } = req.params;
      
      const mascota = await Mascota.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'telefono', 'email', 'direccion_entrega']
          }
        ]
      });
      
      if (!mascota) {
        return res.status(404).json({
          success: false,
          message: 'Mascota no encontrada'
        });
      }

      res.json({
        success: true,
        data: { mascota }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nueva mascota
  async createMascota(req, res, next) {
    try {
      const {
        nombre,
        edad,
        genero,
        raza,
        producto_preferido,
        notas_especiales,
        fkid_cliente
      } = req.body;

      // Verificar que el cliente existe
      const cliente = await Cliente.findByPk(fkid_cliente);
      if (!cliente) {
        return res.status(400).json({
          success: false,
          message: 'El cliente especificado no existe'
        });
      }

      const mascota = await Mascota.create({
        nombre,
        edad,
        genero,
        raza,
        producto_preferido,
        notas_especiales,
        fkid_cliente
      });

      // Obtener la mascota creada con sus relaciones
      const mascotaCompleta = await Mascota.findByPk(mascota.id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'telefono', 'email']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Mascota creada exitosamente',
        data: { mascota: mascotaCompleta }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar mascota
  async updateMascota(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const mascota = await Mascota.findByPk(id);
      
      if (!mascota) {
        return res.status(404).json({
          success: false,
          message: 'Mascota no encontrada'
        });
      }

      // Verificar que el cliente existe (si se está cambiando)
      if (updateData.fkid_cliente) {
        const cliente = await Cliente.findByPk(updateData.fkid_cliente);
        if (!cliente) {
          return res.status(400).json({
            success: false,
            message: 'El cliente especificado no existe'
          });
        }
      }

      await mascota.update(updateData);

      // Obtener la mascota actualizada con sus relaciones
      const mascotaActualizada = await Mascota.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'telefono', 'email']
          }
        ]
      });

      res.json({
        success: true,
        message: 'Mascota actualizada exitosamente',
        data: { mascota: mascotaActualizada }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar mascota (baja lógica)
  async deleteMascota(req, res, next) {
    try {
      const { id } = req.params;

      const mascota = await Mascota.findByPk(id);
      
      if (!mascota) {
        return res.status(404).json({
          success: false,
          message: 'Mascota no encontrada'
        });
      }

      await mascota.softDelete();

      res.json({
        success: true,
        message: 'Mascota eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar mascota
  async restoreMascota(req, res, next) {
    try {
      const { id } = req.params;

      const mascota = await Mascota.findByPk(id);
      
      if (!mascota) {
        return res.status(404).json({
          success: false,
          message: 'Mascota no encontrada'
        });
      }

      await mascota.restore();

      res.json({
        success: true,
        message: 'Mascota restaurada exitosamente',
        data: { mascota }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mascotas por cliente
  async getMascotasByCliente(req, res, next) {
    try {
      const { cliente_id } = req.params;

      const cliente = await Cliente.findByPk(cliente_id);
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      const mascotas = await Mascota.findByCliente(cliente_id);

      res.json({
        success: true,
        data: {
          mascotas,
          total: mascotas.length,
          cliente: {
            id: cliente.id,
            nombre_completo: cliente.nombre_completo
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de mascotas
  async getMascotaStats(req, res, next) {
    try {
      const totalMascotas = await Mascota.count({
        where: { is_active: true }
      });

      const mascotasActivas = await Mascota.count({
        where: { is_active: true }
      });

      const mascotasInactivas = await Mascota.count({
        where: { is_active: false }
      });

      // Mascotas por género
      const mascotasByGenero = await Mascota.findAll({
        attributes: [
          'genero',
          [Mascota.sequelize.fn('COUNT', Mascota.sequelize.col('Mascota.id')), 'count']
        ],
        where: { is_active: true },
        group: ['genero'],
        order: [[Mascota.sequelize.fn('COUNT', Mascota.sequelize.col('Mascota.id')), 'DESC']]
      });

      // Mascotas por raza
      const mascotasByRaza = await Mascota.findAll({
        attributes: [
          'raza',
          [Mascota.sequelize.fn('COUNT', Mascota.sequelize.col('Mascota.id')), 'count']
        ],
          where: { 
            is_active: true,
            raza: { [Op.ne]: null }
          },
        group: ['raza'],
        order: [[Mascota.sequelize.fn('COUNT', Mascota.sequelize.col('Mascota.id')), 'DESC']],
        limit: 10
      });

      res.json({
        success: true,
        data: {
          totalMascotas,
          mascotasActivas,
          mascotasInactivas,
          mascotasByGenero,
          mascotasByRaza
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mascotas activas
  async getActiveMascotas(req, res, next) {
    try {
      const mascotas = await Mascota.findActive();

      res.json({
        success: true,
        data: {
          mascotas,
          total: mascotas.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MascotaController();
