const { Agente, AgenteConversacion, Conversacion } = require('../../models');
const { Op } = require('sequelize');

class AgenteController {
  // Obtener todos los agentes
  async getAllAgentes(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        estado,
        especialidad,
        activos = false,
        search
      } = req.query;

      const offset = (page - 1) * limit;
      const whereClause = { baja_logica: false };

      // Filtros
      if (estado) {
        whereClause.estado = estado;
      }

      if (especialidad) {
        whereClause.especialidad = especialidad;
      }

      if (activos === 'true') {
        whereClause.estado = 'activo';
      }

      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.iLike]: `%${search}%` } },
          { descripcion: { [Op.iLike]: `%${search}%` } },
          { especialidad: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: agentes } = await Agente.findAndCountAll({
        where: whereClause,
        order: [['orden_prioridad', 'ASC'], ['nombre', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          agentes,
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener agente por ID
  async getAgenteById(req, res, next) {
    try {
      const { id } = req.params;

      const agente = await Agente.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!agente) {
        return res.status(404).json({
          success: false,
          message: 'Agente no encontrado'
        });
      }

      res.json({
        success: true,
        data: agente
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo agente
  async createAgente(req, res, next) {
    try {
      const {
        nombre,
        descripcion,
        especialidad,
        contexto,
        system_prompt,
        personalidad,
        configuracion,
        orden_prioridad = 0
      } = req.body;

      const agente = await Agente.create({
        nombre,
        descripcion,
        especialidad,
        contexto,
        system_prompt,
        personalidad,
        configuracion,
        orden_prioridad
      });

      res.status(201).json({
        success: true,
        message: 'Agente creado exitosamente',
        data: agente
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar agente
  async updateAgente(req, res, next) {
    try {
      const { id } = req.params;
      const {
        nombre,
        descripcion,
        especialidad,
        contexto,
        system_prompt,
        personalidad,
        configuracion,
        estado,
        orden_prioridad
      } = req.body;

      const agente = await Agente.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!agente) {
        return res.status(404).json({
          success: false,
          message: 'Agente no encontrado'
        });
      }

      // Actualizar campos
      const updateData = {};
      if (nombre !== undefined) updateData.nombre = nombre;
      if (descripcion !== undefined) updateData.descripcion = descripcion;
      if (especialidad !== undefined) updateData.especialidad = especialidad;
      if (contexto !== undefined) updateData.contexto = contexto;
      if (system_prompt !== undefined) updateData.system_prompt = system_prompt;
      if (personalidad !== undefined) updateData.personalidad = personalidad;
      if (configuracion !== undefined) updateData.configuracion = configuracion;
      if (estado !== undefined) updateData.estado = estado;
      if (orden_prioridad !== undefined) updateData.orden_prioridad = orden_prioridad;

      // Actualizar fecha de actualización si se cambió contexto o system_prompt
      if (contexto !== undefined || system_prompt !== undefined) {
        updateData.fecha_actualizacion = new Date();
      }

      await agente.update(updateData);

      res.json({
        success: true,
        message: 'Agente actualizado exitosamente',
        data: agente
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar agente (soft delete)
  async deleteAgente(req, res, next) {
    try {
      const { id } = req.params;

      const agente = await Agente.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!agente) {
        return res.status(404).json({
          success: false,
          message: 'Agente no encontrado'
        });
      }

      await agente.update({ baja_logica: true });

      res.json({
        success: true,
        message: 'Agente eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar agente
  async restoreAgente(req, res, next) {
    try {
      const { id } = req.params;

      const agente = await Agente.findByPk(id, {
        where: { baja_logica: true }
      });

      if (!agente) {
        return res.status(404).json({
          success: false,
          message: 'Agente no encontrado'
        });
      }

      await agente.update({ baja_logica: false });

      res.json({
        success: true,
        message: 'Agente restaurado exitosamente',
        data: agente
      });
    } catch (error) {
      next(error);
    }
  }

  // Cambiar estado del agente
  async changeEstado(req, res, next) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      if (!['activo', 'inactivo', 'mantenimiento'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido'
        });
      }

      const agente = await Agente.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!agente) {
        return res.status(404).json({
          success: false,
          message: 'Agente no encontrado'
        });
      }

      await agente.update({ estado });

      res.json({
        success: true,
        message: `Agente ${estado} exitosamente`,
        data: agente
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener agentes activos para selección
  async getAgentesActivos(req, res, next) {
    try {
      const agentes = await Agente.findActivos();

      res.json({
        success: true,
        data: agentes
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener agentes por especialidad
  async getAgentesByEspecialidad(req, res, next) {
    try {
      const { especialidad } = req.params;

      const agentes = await Agente.findByEspecialidad(especialidad);

      res.json({
        success: true,
        data: agentes
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener estadísticas de agentes
  async getEstadisticas(req, res, next) {
    try {
      const estadisticas = await Agente.obtenerEstadisticas();

      res.json({
        success: true,
        data: estadisticas
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener conversaciones de un agente
  async getConversacionesAgente(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const offset = (page - 1) * limit;

      const { count, rows: conversaciones } = await AgenteConversacion.findAndCountAll({
        where: { fkid_agente: id },
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'status', 'created_at']
          }
        ],
        order: [['fecha_asignacion', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          conversaciones,
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar rendimiento de agente en conversación
  async updateRendimiento(req, res, next) {
    try {
      const { id } = req.params;
      const { rendimiento, feedback } = req.body;

      if (rendimiento < 0 || rendimiento > 5) {
        return res.status(400).json({
          success: false,
          message: 'El rendimiento debe estar entre 0 y 5'
        });
      }

      const agenteConversacion = await AgenteConversacion.findByPk(id);

      if (!agenteConversacion) {
        return res.status(404).json({
          success: false,
          message: 'Asignación no encontrada'
        });
      }

      await agenteConversacion.actualizarRendimiento(rendimiento, feedback);

      res.json({
        success: true,
        message: 'Rendimiento actualizado exitosamente',
        data: agenteConversacion
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AgenteController();
