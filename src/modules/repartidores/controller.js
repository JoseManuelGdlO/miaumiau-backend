const { Repartidor, City, User, Ruta } = require('../../models');
const { Op } = require('sequelize');

class RepartidorController {
  // Obtener todos los repartidores
  async getAllRepartidores(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        estado,
        tipo_vehiculo,
        ciudad,
        disponibles = false,
        search
      } = req.query;

      const offset = (page - 1) * limit;
      const whereClause = { baja_logica: false };

      // Filtros
      if (estado) {
        whereClause.estado = estado;
      }

      if (tipo_vehiculo) {
        whereClause.tipo_vehiculo = tipo_vehiculo;
      }

      if (ciudad) {
        whereClause.fkid_ciudad = ciudad;
      }

      if (disponibles === 'true') {
        whereClause.estado = 'disponible';
      }

      if (search) {
        whereClause[Op.or] = [
          { nombre_completo: { [Op.iLike]: `%${search}%` } },
          { codigo_repartidor: { [Op.iLike]: `%${search}%` } },
          { telefono: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: repartidores } = await Repartidor.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: User,
            as: 'usuario',
            attributes: ['id', 'nombre_completo', 'correo_electronico'],
            required: false
          }
        ],
        order: [['nombre_completo', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          repartidores,
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

  // Obtener repartidor por ID
  async getRepartidorById(req, res, next) {
    try {
      const { id } = req.params;

      const repartidor = await Repartidor.findByPk(id, {
        where: { baja_logica: false },
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: User,
            as: 'usuario',
            attributes: ['id', 'nombre_completo', 'correo_electronico'],
            required: false
          },
          {
            model: Ruta,
            as: 'rutas',
            attributes: ['id', 'nombre_ruta', 'fecha_ruta', 'estado'],
            limit: 5,
            order: [['fecha_ruta', 'DESC']],
            required: false
          }
        ]
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      res.json({
        success: true,
        data: repartidor
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo repartidor
  async createRepartidor(req, res, next) {
    try {
      const {
        codigo_repartidor,
        nombre_completo,
        telefono,
        email,
        fkid_ciudad,
        fkid_usuario,
        tipo_vehiculo,
        capacidad_carga,
        zona_cobertura,
        horario_trabajo,
        tarifa_base,
        comision_porcentaje,
        fecha_ingreso,
        fecha_nacimiento,
        direccion,
        documento_identidad,
        licencia_conducir,
        seguro_vehiculo,
        notas
      } = req.body;

      const repartidor = await Repartidor.create({
        codigo_repartidor,
        nombre_completo,
        telefono,
        email,
        fkid_ciudad,
        fkid_usuario,
        tipo_vehiculo,
        capacidad_carga,
        zona_cobertura,
        horario_trabajo,
        tarifa_base,
        comision_porcentaje,
        fecha_ingreso,
        fecha_nacimiento,
        direccion,
        documento_identidad,
        licencia_conducir,
        seguro_vehiculo,
        notas
      });

      res.status(201).json({
        success: true,
        message: 'Repartidor creado exitosamente',
        data: repartidor
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar repartidor
  async updateRepartidor(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const repartidor = await Repartidor.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      await repartidor.update(updateData);

      res.json({
        success: true,
        message: 'Repartidor actualizado exitosamente',
        data: repartidor
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar repartidor (soft delete)
  async deleteRepartidor(req, res, next) {
    try {
      const { id } = req.params;

      const repartidor = await Repartidor.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      await repartidor.update({ baja_logica: true });

      res.json({
        success: true,
        message: 'Repartidor eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar repartidor
  async restoreRepartidor(req, res, next) {
    try {
      const { id } = req.params;

      const repartidor = await Repartidor.findByPk(id, {
        where: { baja_logica: true }
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      await repartidor.update({ baja_logica: false });

      res.json({
        success: true,
        message: 'Repartidor restaurado exitosamente',
        data: repartidor
      });
    } catch (error) {
      next(error);
    }
  }

  // Cambiar estado del repartidor
  async changeEstado(req, res, next) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      if (!['activo', 'inactivo', 'ocupado', 'disponible', 'en_ruta'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido'
        });
      }

      const repartidor = await Repartidor.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      await repartidor.update({ estado });

      res.json({
        success: true,
        message: `Repartidor ${estado} exitosamente`,
        data: repartidor
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener repartidores disponibles
  async getRepartidoresDisponibles(req, res, next) {
    try {
      const { ciudad } = req.query;

      const repartidores = await Repartidor.findDisponibles(ciudad);

      res.json({
        success: true,
        data: repartidores
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener repartidores por ciudad
  async getRepartidoresByCiudad(req, res, next) {
    try {
      const { ciudadId } = req.params;

      const repartidores = await Repartidor.findByCiudad(ciudadId);

      res.json({
        success: true,
        data: repartidores
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener repartidores por tipo de vehículo
  async getRepartidoresByTipoVehiculo(req, res, next) {
    try {
      const { tipo } = req.params;

      const repartidores = await Repartidor.findByTipoVehiculo(tipo);

      res.json({
        success: true,
        data: repartidores
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mejores calificados
  async getMejoresCalificados(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const repartidores = await Repartidor.findMejoresCalificados(parseInt(limit));

      res.json({
        success: true,
        data: repartidores
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener estadísticas
  async getEstadisticas(req, res, next) {
    try {
      const estadisticas = await Repartidor.obtenerEstadisticas();

      res.json({
        success: true,
        data: estadisticas
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener estadísticas por ciudad
  async getEstadisticasPorCiudad(req, res, next) {
    try {
      const estadisticas = await Repartidor.obtenerEstadisticasPorCiudad();

      res.json({
        success: true,
        data: estadisticas
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar métricas del repartidor
  async updateMetricas(req, res, next) {
    try {
      const { id } = req.params;
      const { entregas = 0, km = 0, calificacion } = req.body;

      const repartidor = await Repartidor.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      await repartidor.actualizarMetricas(entregas, km);

      if (calificacion !== undefined) {
        await repartidor.actualizarCalificacion(calificacion);
      }

      res.json({
        success: true,
        message: 'Métricas actualizadas exitosamente',
        data: repartidor
      });
    } catch (error) {
      next(error);
    }
  }

  // Verificar si repartidor está en horario de trabajo
  async checkHorarioTrabajo(req, res, next) {
    try {
      const { id } = req.params;
      const { fecha } = req.query;

      const repartidor = await Repartidor.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      const fechaConsulta = fecha ? new Date(fecha) : new Date();
      const enHorario = repartidor.estaEnHorarioTrabajo(fechaConsulta);

      res.json({
        success: true,
        data: {
          repartidor_id: repartidor.id,
          nombre: repartidor.nombre_completo,
          en_horario: enHorario,
          fecha_consulta: fechaConsulta,
          horario_trabajo: repartidor.obtenerHorarioTrabajo()
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RepartidorController();
