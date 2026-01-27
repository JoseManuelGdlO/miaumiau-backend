const { Repartidor, City, User, Ruta, RutaPedido, Pedido, Cliente, ProductoPedido, Inventario, PaquetePedido, Paquete } = require('../../models');
const { Op } = require('sequelize');
const { applyCityFilter } = require('../../utils/cityFilter');
const bcrypt = require('bcryptjs');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Sequelize } = require('sequelize');

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

      // Aplicar filtro de ciudad según el usuario autenticado
      // Si el usuario tiene ciudad asignada, solo puede ver repartidores de su ciudad
      // Si no tiene ciudad asignada, puede ver todos los repartidores
      applyCityFilter(req, whereClause, 'fkid_ciudad');

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
        attributes: {
          exclude: ['contrasena']
        },
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
        attributes: {
          exclude: ['contrasena']
        },
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
        notas,
        contrasena
      } = req.body;

      // Hashear la contraseña si se proporciona
      let hashedPassword = null;
      if (contrasena) {
        hashedPassword = await bcrypt.hash(contrasena, 12);
      }

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
        notas,
        contrasena: hashedPassword
      });

      // No devolver la contraseña en la respuesta
      const repartidorResponse = repartidor.toJSON();
      delete repartidorResponse.contrasena;

      res.status(201).json({
        success: true,
        message: 'Repartidor creado exitosamente',
        data: repartidorResponse
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar repartidor
  async updateRepartidor(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      const repartidor = await Repartidor.findByPk(id, {
        where: { baja_logica: false }
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      // Eliminar campos que vienen como null (no se actualizan, se mantiene el valor existente)
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === null || updateData[key] === 'null') {
          delete updateData[key];
        }
      });

      // Hashear la contraseña si se está actualizando
      if (updateData.contrasena) {
        updateData.contrasena = await bcrypt.hash(updateData.contrasena, 12);
      }

      await repartidor.update(updateData);

      // No devolver la contraseña en la respuesta
      const repartidorResponse = repartidor.toJSON();
      delete repartidorResponse.contrasena;

      res.json({
        success: true,
        message: 'Repartidor actualizado exitosamente',
        data: repartidorResponse
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

  // Login de repartidor
  async loginRepartidor(req, res, next) {
    try {
      const { email, codigo_repartidor, contrasena } = req.body;

      // Validar que se proporcione email o codigo_repartidor
      if (!email && !codigo_repartidor) {
        return res.status(400).json({
          success: false,
          message: 'Debes proporcionar email o código de repartidor'
        });
      }

      if (!contrasena) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña es requerida'
        });
      }

      // Buscar repartidor por email o código
      const whereClause = {
        baja_logica: false
      };

      if (email) {
        whereClause.email = email;
      } else {
        whereClause.codigo_repartidor = codigo_repartidor;
      }

      const repartidor = await Repartidor.findOne({
        where: whereClause,
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ]
      });

      if (!repartidor) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Verificar que el repartidor tenga contraseña configurada
      if (!repartidor.contrasena) {
        return res.status(401).json({
          success: false,
          message: 'El repartidor no tiene contraseña configurada. Contacta al administrador.'
        });
      }

      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(contrasena, repartidor.contrasena);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Verificar que el repartidor esté activo
      if (!['activo', 'disponible'].includes(repartidor.estado)) {
        return res.status(401).json({
          success: false,
          message: 'Tu cuenta está inactiva. Contacta al administrador.'
        });
      }

      // Generar tokens
      const token = generateToken({
        repartidorId: repartidor.id,
        email: repartidor.email,
        codigo_repartidor: repartidor.codigo_repartidor,
        tipo: 'repartidor'
      });

      const refreshToken = generateRefreshToken({
        repartidorId: repartidor.id,
        tipo: 'repartidor'
      });

      // Preparar respuesta sin contraseña
      const repartidorResponse = repartidor.toJSON();

      res.json({
        success: true,
        message: 'Login exitoso',
        data: {
          repartidor: {
            id: repartidorResponse.id,
            codigo_repartidor: repartidorResponse.codigo_repartidor,
            nombre_completo: repartidorResponse.nombre_completo,
            telefono: repartidorResponse.telefono,
            email: repartidorResponse.email,
            tipo_vehiculo: repartidorResponse.tipo_vehiculo,
            estado: repartidorResponse.estado,
            ciudad: repartidorResponse.ciudad,
            calificacion_promedio: repartidorResponse.calificacion_promedio,
            total_entregas: repartidorResponse.total_entregas
          },
          token,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener pedidos del día del repartidor
  async getPedidosDelDia(req, res, next) {
    try {
      // Obtener el ID del repartidor desde el query parameter o del token autenticado
      const repartidorIdParam = req.query.repartidor_id || req.query.repartidorId;
      const repartidorId = repartidorIdParam ? parseInt(repartidorIdParam) : req.repartidorId;
      
      console.log('=== INICIO getPedidosDelDia ===');
      console.log('Query params:', req.query);
      console.log('repartidorIdParam:', repartidorIdParam);
      console.log('req.repartidorId (del token):', req.repartidorId);
      console.log('repartidorId final:', repartidorId);
      
      // Obtener la fecha de hoy en formato YYYY-MM-DD
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaHoy = hoy.toISOString().split('T')[0]; // Formato: YYYY-MM-DD
      
      console.log('Fecha de hoy (formato YYYY-MM-DD):', fechaHoy);
      console.log('Fecha de hoy (Date object):', hoy);

      // Verificar que el repartidorId existe
      if (!repartidorId || isNaN(repartidorId)) {
        console.log('ERROR: repartidorId inválido');
        return res.status(400).json({
          success: false,
          message: 'ID de repartidor requerido'
        });
      }

      // Verificar que el repartidor existe
      const repartidor = await Repartidor.findByPk(repartidorId, {
        where: { baja_logica: false }
      });

      if (!repartidor) {
        console.log('ERROR: Repartidor no encontrado con ID:', repartidorId);
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      console.log('Repartidor encontrado:', {
        id: repartidor.id,
        nombre: repartidor.nombre_completo,
        codigo: repartidor.codigo_repartidor
      });

      // Buscar rutas planificadas del repartidor del día actual
      const whereClause = {
        fkid_repartidor: repartidorId,
        fecha_ruta: {
          [Op.eq]: fechaHoy
        },
        estado: 'planificada' // Solo rutas planificadas
      };
      
      console.log('=== BÚSQUEDA DE RUTAS ===');
      console.log('Where clause:', JSON.stringify(whereClause, null, 2));
      console.log('fkid_repartidor:', repartidorId, 'tipo:', typeof repartidorId);
      console.log('fecha_ruta:', fechaHoy, 'tipo:', typeof fechaHoy);
      console.log('estado:', 'planificada');
      
      const rutas = await Ruta.findAll({
        where: whereClause,
        include: [
          {
            model: RutaPedido,
            as: 'pedidos',
            include: [
              {
                model: Pedido,
                as: 'pedido',
                include: [
                  {
                    model: Cliente,
                    as: 'cliente',
                    attributes: ['id', 'nombre_completo', 'telefono', 'email']
                  },
                  {
                    model: ProductoPedido,
                    as: 'productos',
                    include: [
                      {
                        model: Inventario,
                        as: 'producto',
                        attributes: ['id', 'nombre', 'descripcion', 'sku']
                      }
                    ]
                  },
                  {
                    model: PaquetePedido,
                    as: 'paquetes',
                    include: [
                      {
                        model: Paquete,
                        as: 'paquete',
                        attributes: ['id', 'nombre', 'descripcion']
                      }
                    ]
                  }
                ]
              }
            ],
            order: [['orden_entrega', 'ASC']]
          }
        ]
      });

      console.log('=== RESULTADOS DE LA BÚSQUEDA ===');
      console.log('Total de rutas encontradas:', rutas.length);
      rutas.forEach((ruta, index) => {
        console.log(`Ruta ${index + 1}:`, {
          id: ruta.id,
          fkid_repartidor: ruta.fkid_repartidor,
          fecha_ruta: ruta.fecha_ruta,
          estado: ruta.estado,
          total_pedidos: ruta.pedidos?.length || 0
        });
      });

      // Extraer todos los pedidos de las rutas y verificar que pertenezcan al repartidor
      const pedidos = [];
      rutas.forEach(ruta => {
        // Verificar que la ruta pertenezca al repartidor
        if (ruta.fkid_repartidor !== repartidorId) {
          return; // Saltar esta ruta si no pertenece al repartidor
        }
        
        // Verificar que la fecha de la ruta sea la de hoy
        const fechaRuta = ruta.fecha_ruta ? new Date(ruta.fecha_ruta).toISOString().split('T')[0] : null;
        if (fechaRuta !== fechaHoy) {
          return; // Saltar esta ruta si no es del día de hoy
        }

        ruta.pedidos.forEach(rutaPedido => {
          if (rutaPedido.pedido) {
            pedidos.push({
              id: rutaPedido.pedido.id,
              numero_pedido: rutaPedido.pedido.numero_pedido,
              direccion_entrega: rutaPedido.pedido.direccion_entrega,
              fecha_pedido: rutaPedido.pedido.fecha_pedido,
              fecha_entrega_estimada: rutaPedido.pedido.fecha_entrega_estimada,
              total: rutaPedido.pedido.total,
              estado_pedido: rutaPedido.pedido.estado,
              estado_entrega: rutaPedido.estado_entrega,
              orden_entrega: rutaPedido.orden_entrega,
              notas_entrega: rutaPedido.notas_entrega,
              cliente: rutaPedido.pedido.cliente,
              productos: rutaPedido.pedido.productos,
              paquetes: rutaPedido.pedido.paquetes,
              ruta_id: ruta.id,
              ruta_pedido_id: rutaPedido.id
            });
          }
        });
      });

      // Ordenar por orden de entrega
      pedidos.sort((a, b) => a.orden_entrega - b.orden_entrega);

      console.log('=== PEDIDOS FINALES ===');
      console.log('Total de pedidos extraídos:', pedidos.length);
      if (pedidos.length > 0) {
        console.log('IDs de pedidos:', pedidos.map(p => p.id));
        console.log('Fechas de pedidos:', pedidos.map(p => ({
          id: p.id,
          numero_pedido: p.numero_pedido,
          fecha_pedido: p.fecha_pedido,
          fecha_entrega_estimada: p.fecha_entrega_estimada,
          estado_entrega: p.estado_entrega
        })));
      } else {
        console.log('No se encontraron pedidos para este repartidor en el día de hoy');
      }
      console.log('=== FIN getPedidosDelDia ===');

      res.json({
        success: true,
        data: {
          pedidos,
          total: pedidos.length,
          fecha: fechaHoy
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar estado de entrega de un pedido
  async updateEstadoPedido(req, res, next) {
    try {
      const { id } = req.params; // ID del pedido
      const { estado, notas } = req.body;
      const repartidorId = req.repartidorId;

      // Validar estado
      const estadosValidos = ['pendiente', 'en_camino', 'en_ubicacion', 'entregado', 'no_entregado'];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          success: false,
          message: `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}`
        });
      }

      // Buscar el pedido en las rutas del repartidor
      const rutaPedido = await RutaPedido.findOne({
        where: {
          fkid_pedido: id
        },
        include: [
          {
            model: Ruta,
            as: 'ruta',
            where: {
              fkid_repartidor: repartidorId
            }
          }
        ]
      });

      if (!rutaPedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado o no asignado a este repartidor'
        });
      }

      // Mapear estados del frontend a estados de la BD
      let estadoBD = estado;
      if (estado === 'en_ubicacion') {
        estadoBD = 'en_camino'; // Usamos en_camino para "en la ubicación"
      } else if (estado === 'no_entregado') {
        estadoBD = 'fallido';
      }

      // Actualizar estado de entrega
      const updateData = {
        estado_entrega: estadoBD
      };

      if (notas) {
        updateData.notas_entrega = notas;
      }

      if (estadoBD === 'entregado' || estadoBD === 'fallido') {
        updateData.fecha_entrega_real = new Date();
      }

      await rutaPedido.update(updateData);

      // Si se entregó, actualizar también el estado del pedido
      if (estadoBD === 'entregado') {
        await Pedido.update(
          { 
            estado: 'entregado',
            fecha_entrega_real: new Date()
          },
          { where: { id } }
        );
      }

      // Si no se entregó, actualizar también el estado del pedido
      if (estadoBD === 'fallido') {
        await Pedido.update(
          { 
            estado: 'no_entregado'
          },
          { where: { id } }
        );
      }

      // Obtener el pedido actualizado
      const pedidoActualizado = await Pedido.findByPk(id, {
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
        message: `Estado del pedido actualizado a: ${estado}`,
        data: {
          pedido: pedidoActualizado,
          estado_entrega: rutaPedido.estado_entrega,
          fecha_entrega_real: rutaPedido.fecha_entrega_real
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RepartidorController();
