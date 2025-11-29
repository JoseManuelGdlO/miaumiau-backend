const { Ruta, RutaPedido, Pedido, Repartidor, City, Cliente, Inventario, CategoriaProducto, ProductoPedido, PaquetePedido, Paquete } = require('../../models');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');

class RutaController {
  // Crear nueva ruta
  async createRuta(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const {
        nombre_ruta,
        fecha_ruta,
        fkid_ciudad,
        fkid_repartidor,
        estado = 'planificada',
        notas
      } = req.body;

      // Verificar que el repartidor existe y está disponible
      const repartidor = await Repartidor.findByPk(fkid_repartidor, {
        include: ['ciudad']
      });

      if (!repartidor) {
        return res.status(404).json({
          success: false,
          message: 'Repartidor no encontrado'
        });
      }

      if (repartidor.estado !== 'disponible' && repartidor.estado !== 'activo') {
        return res.status(400).json({
          success: false,
          message: 'El repartidor no está disponible para asignar rutas'
        });
      }

      // Verificar que la ciudad existe
      const ciudad = await City.findByPk(fkid_ciudad);
      if (!ciudad) {
        return res.status(404).json({
          success: false,
          message: 'Ciudad no encontrada'
        });
      }

      // Crear la ruta
      const ruta = await Ruta.create({
        nombre_ruta,
        fecha_ruta,
        fkid_ciudad,
        fkid_repartidor,
        estado,
        notas,
        total_pedidos: 0,
        total_entregados: 0,
        distancia_estimada: 0.00,
        tiempo_estimado: 0
      });

      // Obtener la ruta creada con sus asociaciones
      const rutaCompleta = await Ruta.findByPk(ruta.id, {
        include: [
          {
            model: Repartidor,
            as: 'repartidor',
            include: ['ciudad']
          },
          {
            model: City,
            as: 'ciudad'
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Ruta creada exitosamente',
        data: rutaCompleta
      });

    } catch (error) {
      console.error('Error al crear ruta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener todas las rutas con filtros
  async getAllRutas(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        estado,
        fecha_ruta,
        fkid_ciudad,
        fkid_repartidor,
        search
      } = req.query;

      const offset = (page - 1) * limit;
      const where = { baja_logica: false };

      // Aplicar filtros
      if (estado) {
        where.estado = estado;
      }

      if (fecha_ruta) {
        where.fecha_ruta = fecha_ruta;
      }

      if (fkid_ciudad) {
        where.fkid_ciudad = fkid_ciudad;
      }

      if (fkid_repartidor) {
        where.fkid_repartidor = fkid_repartidor;
      }

      if (search) {
        where.nombre_ruta = {
          [Op.iLike]: `%${search}%`
        };
      }

      const { count, rows: rutas } = await Ruta.findAndCountAll({
        where,
        include: [
          {
            model: Repartidor,
            as: 'repartidor',
            include: ['ciudad']
          },
          {
            model: City,
            as: 'ciudad'
          },
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
                    as: 'cliente'
                  }
                ]
              }
            ]
          }
        ],
        order: [['fecha_ruta', 'DESC'], ['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          rutas,
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });

    } catch (error) {
      console.error('Error al obtener rutas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener rutas por día específico
  async getRutasByDate(req, res) {
    try {
      const { fecha } = req.params;
      const { fkid_ciudad, estado } = req.query;

      console.log(`[getRutasByDate] Obteniendo rutas para fecha: ${fecha}, ciudad: ${fkid_ciudad}, estado: ${estado}`);

      const where = {
        fecha_ruta: fecha,
        baja_logica: false,
        estado: 'planificada' // Solo rutas planificadas
      };

      if (fkid_ciudad) {
        where.fkid_ciudad = fkid_ciudad;
      }

      // Si se especifica un estado diferente, se puede sobrescribir
      if (estado) {
        where.estado = estado;
      }

      const rutas = await Ruta.findAll({
        where,
        include: [
          {
            model: Repartidor,
            as: 'repartidor',
            include: ['ciudad']
          },
          {
            model: City,
            as: 'ciudad'
          },
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
                    as: 'cliente'
                  },
                  {
                    model: ProductoPedido,
                    as: 'productos',
                    required: false,
                    separate: true,
                    include: [
                      {
                        model: Inventario,
                        as: 'producto',
                        required: false
                      }
                    ]
                  },
                  {
                    model: PaquetePedido,
                    as: 'paquetes',
                    required: false,
                    separate: true,
                    include: [
                      {
                        model: Paquete,
                        as: 'paquete',
                        required: false
                      }
                    ]
                  }
                ]
              }
            ],
            order: [['orden_entrega', 'ASC']]
          }
        ],
        order: [['created_at', 'ASC']]
      });

      console.log(`[getRutasByDate] Encontradas ${rutas.length} rutas`);

      // Cargar productos y paquetes para cada pedido manualmente
      const rutasConDetalles = [];
      for (const ruta of rutas) {
        console.log(`[getRutasByDate] Procesando ruta ${ruta.id} con ${ruta.pedidos.length} pedidos`);
        const rutaData = ruta.toJSON();
        const pedidosConDetalles = [];
        
        for (const rutaPedido of ruta.pedidos) {
          const rutaPedidoData = rutaPedido.toJSON();
          
          if (rutaPedidoData.pedido && rutaPedidoData.pedido.id) {
            // Cargar productos manualmente
            const productos = await ProductoPedido.findAll({
              where: { fkid_pedido: rutaPedidoData.pedido.id },
              include: [
                {
                  model: Inventario,
                  as: 'producto',
                  required: false
                }
              ]
            });
            
            // Cargar paquetes manualmente
            const paquetes = await PaquetePedido.findAll({
              where: { fkid_pedido: rutaPedidoData.pedido.id },
              include: [
                {
                  model: Paquete,
                  as: 'paquete',
                  required: false
                }
              ]
            });
            
            // Asignar productos y paquetes al pedido
            rutaPedidoData.pedido.productos = productos.map(p => p.toJSON());
            rutaPedidoData.pedido.paquetes = paquetes.map(p => p.toJSON());
            
            // Log para depuración
            console.log(`Pedido ${rutaPedidoData.pedido.id} (${rutaPedidoData.pedido.numero_pedido}): ${productos.length} productos, ${paquetes.length} paquetes`);
          }
          
          pedidosConDetalles.push(rutaPedidoData);
        }
        
        rutaData.pedidos = pedidosConDetalles;
        rutasConDetalles.push(rutaData);
      }

      // Usar las rutas con detalles cargados manualmente
      const rutasJSON = rutasConDetalles;

      res.json({
        success: true,
        data: {
          fecha,
          rutas: rutasJSON,
          total_rutas: rutas.length,
          total_pedidos: rutas.reduce((sum, ruta) => sum + ruta.pedidos.length, 0)
        }
      });

    } catch (error) {
      console.error('Error al obtener rutas por fecha:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener pedidos sin asignar por día
  async getPedidosSinAsignar(req, res) {
    try {
      const { fecha } = req.params;
      const { fkid_ciudad, page = 1, limit = 50 } = req.query;

      const offset = (page - 1) * limit;

      // Crear rango de fechas para buscar todo el día
      const fechaInicio = new Date(fecha + 'T00:00:00.000Z');
      const fechaFin = new Date(fecha + 'T23:59:59.999Z');

      // Buscar pedidos que no estén asignados a ninguna ruta para esa fecha de entrega
      const pedidosSinAsignar = await Pedido.findAll({
        where: {
          fecha_entrega_estimada: {
            [Op.between]: [fechaInicio, fechaFin]
          },
          baja_logica: false,
          id: {
            [Op.notIn]: await RutaPedido.findAll({
              attributes: ['fkid_pedido'],
              include: [
                {
                  model: Ruta,
                  as: 'ruta',
                  where: {
                    fecha_ruta: fecha,
                    baja_logica: false
                  },
                  attributes: []
                }
              ]
            }).then(results => results.map(r => r.fkid_pedido))
          }
        },
        include: [
          {
            model: Cliente,
            as: 'cliente',
            include: ['ciudad']
          },
          {
            model: ProductoPedido,
            as: 'productos',
            include: [
              {
                model: Inventario,
                as: 'producto',
                include: [
                  {
                    model: CategoriaProducto,
                    as: 'categoria'
                  }
                ]
              }
            ]
          }
        ],
        order: [['created_at', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Filtrar por ciudad si se especifica
      let pedidosFiltrados = pedidosSinAsignar;
      if (fkid_ciudad) {
        pedidosFiltrados = pedidosSinAsignar.filter(pedido => 
          pedido.cliente && pedido.cliente.fkid_ciudad == fkid_ciudad
        );
      }

      // Contar total para paginación
      const totalCount = await Pedido.count({
        where: {
          fecha_entrega_estimada: {
            [Op.between]: [fechaInicio, fechaFin]
          },
          baja_logica: false,
          id: {
            [Op.notIn]: await RutaPedido.findAll({
              attributes: ['fkid_pedido'],
              include: [
                {
                  model: Ruta,
                  as: 'ruta',
                  where: {
                    fecha_ruta: fecha,
                    baja_logica: false
                  },
                  attributes: []
                }
              ]
            }).then(results => results.map(r => r.fkid_pedido))
          }
        },
        include: [
          {
            model: Cliente,
            as: 'cliente',
            where: fkid_ciudad ? { fkid_ciudad } : undefined,
            attributes: []
          }
        ]
      });

      res.json({
        success: true,
        data: {
          fecha,
          pedidos: pedidosFiltrados,
          total: fkid_ciudad ? pedidosFiltrados.length : totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil((fkid_ciudad ? pedidosFiltrados.length : totalCount) / limit)
        }
      });

    } catch (error) {
      console.error('Error al obtener pedidos sin asignar:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener ruta por ID
  async getRutaById(req, res) {
    try {
      const { id } = req.params;

      const ruta = await Ruta.findByPk(id, {
        include: [
          {
            model: Repartidor,
            as: 'repartidor',
            include: ['ciudad']
          },
          {
            model: City,
            as: 'ciudad'
          },
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
                    include: ['ciudad']
                  },
                  {
                    model: Inventario,
                    as: 'productos',
                    include: [
                      {
                        model: CategoriaProducto,
                        as: 'categoria'
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

      if (!ruta) {
        return res.status(404).json({
          success: false,
          message: 'Ruta no encontrada'
        });
      }

      res.json({
        success: true,
        data: ruta
      });

    } catch (error) {
      console.error('Error al obtener ruta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Actualizar ruta
  async updateRuta(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      const ruta = await Ruta.findByPk(id);
      if (!ruta) {
        return res.status(404).json({
          success: false,
          message: 'Ruta no encontrada'
        });
      }

      // Si se está cambiando el repartidor, verificar disponibilidad
      if (updateData.fkid_repartidor && updateData.fkid_repartidor !== ruta.fkid_repartidor) {
        const repartidor = await Repartidor.findByPk(updateData.fkid_repartidor);
        if (!repartidor) {
          return res.status(404).json({
            success: false,
            message: 'Repartidor no encontrado'
          });
        }

        if (repartidor.estado !== 'disponible' && repartidor.estado !== 'activo') {
          return res.status(400).json({
            success: false,
            message: 'El repartidor no está disponible para asignar rutas'
          });
        }
      }

      await ruta.update(updateData);

      // Obtener la ruta actualizada con sus asociaciones
      const rutaActualizada = await Ruta.findByPk(id, {
        include: [
          {
            model: Repartidor,
            as: 'repartidor',
            include: ['ciudad']
          },
          {
            model: City,
            as: 'ciudad'
          },
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
                    as: 'cliente'
                  }
                ]
              }
            ]
          }
        ]
      });

      res.json({
        success: true,
        message: 'Ruta actualizada exitosamente',
        data: rutaActualizada
      });

    } catch (error) {
      console.error('Error al actualizar ruta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Asignar pedidos a una ruta
  async asignarPedidos(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { pedidos } = req.body;

      const ruta = await Ruta.findByPk(id);
      if (!ruta) {
        return res.status(404).json({
          success: false,
          message: 'Ruta no encontrada'
        });
      }

      // Verificar que los pedidos existen y no están asignados
      const pedidoIds = pedidos.map(p => p.fkid_pedido);
      const pedidosExistentes = await Pedido.findAll({
        where: {
          id: pedidoIds,
          baja_logica: false
        }
      });

      if (pedidosExistentes.length !== pedidoIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Algunos pedidos no existen o están dados de baja'
        });
      }

      // Verificar que los pedidos no estén ya asignados a otra ruta
      const pedidosAsignados = await RutaPedido.findAll({
        where: {
          fkid_pedido: pedidoIds
        },
        include: [
          {
            model: Ruta,
            as: 'ruta',
            where: {
              baja_logica: false
            },
            attributes: ['id', 'nombre_ruta', 'fecha_ruta']
          }
        ]
      });

      if (pedidosAsignados.length > 0) {
        const rutasConflictivas = pedidosAsignados.map(rp => ({
          pedido_id: rp.fkid_pedido,
          ruta_id: rp.ruta.id,
          ruta_nombre: rp.ruta.nombre_ruta,
          fecha: rp.ruta.fecha_ruta
        }));

        return res.status(400).json({
          success: false,
          message: 'Algunos pedidos ya están asignados a otras rutas',
          pedidos_conflictivos: rutasConflictivas
        });
      }

      // Crear las asignaciones de pedidos
      const rutaPedidos = await Promise.all(
        pedidos.map(pedido => 
          RutaPedido.create({
            fkid_ruta: id,
            fkid_pedido: pedido.fkid_pedido,
            orden_entrega: pedido.orden_entrega,
            lat: pedido.lat || null,
            lng: pedido.lng || null,
            link_ubicacion: pedido.link_ubicacion || null,
            estado_entrega: 'pendiente',
            notas_entrega: pedido.notas_entrega || null
          })
        )
      );

      // Actualizar el total de pedidos en la ruta
      await ruta.update({
        total_pedidos: ruta.total_pedidos + pedidos.length
      });

      // Obtener los pedidos asignados con sus detalles
      const pedidosAsignadosCompletos = await RutaPedido.findAll({
        where: {
          fkid_ruta: id
        },
        include: [
          {
            model: Pedido,
            as: 'pedido',
            include: [
              {
                model: Cliente,
                as: 'cliente',
                include: ['ciudad']
              }
            ]
          }
        ],
        order: [['orden_entrega', 'ASC']]
      });

      res.json({
        success: true,
        message: 'Pedidos asignados a la ruta exitosamente',
        data: {
          ruta_id: id,
          pedidos_asignados: pedidos.length,
          total_pedidos_ruta: ruta.total_pedidos,
          pedidos: pedidosAsignadosCompletos
        }
      });

    } catch (error) {
      console.error('Error al asignar pedidos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Cambiar estado de la ruta
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      const ruta = await Ruta.findByPk(id);
      if (!ruta) {
        return res.status(404).json({
          success: false,
          message: 'Ruta no encontrada'
        });
      }

      await ruta.update({ estado });

      res.json({
        success: true,
        message: `Ruta ${estado} exitosamente`,
        data: {
          id: ruta.id,
          nombre_ruta: ruta.nombre_ruta,
          estado: ruta.estado,
          updated_at: ruta.updated_at
        }
      });

    } catch (error) {
      console.error('Error al cambiar estado de ruta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Eliminar ruta (soft delete)
  async deleteRuta(req, res) {
    try {
      const { id } = req.params;

      const ruta = await Ruta.findByPk(id);
      if (!ruta) {
        return res.status(404).json({
          success: false,
          message: 'Ruta no encontrada'
        });
      }

      await ruta.update({ baja_logica: true });

      res.json({
        success: true,
        message: 'Ruta eliminada exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar ruta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Restaurar ruta
  async restoreRuta(req, res) {
    try {
      const { id } = req.params;

      const ruta = await Ruta.findByPk(id);
      if (!ruta) {
        return res.status(404).json({
          success: false,
          message: 'Ruta no encontrada'
        });
      }

      await ruta.update({ baja_logica: false });

      res.json({
        success: true,
        message: 'Ruta restaurada exitosamente',
        data: {
          id: ruta.id,
          nombre_ruta: ruta.nombre_ruta,
          baja_logica: false,
          updated_at: ruta.updated_at
        }
      });

    } catch (error) {
      console.error('Error al restaurar ruta:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Obtener estadísticas de rutas
  async getEstadisticas(req, res) {
    try {
      const { fecha_inicio, fecha_fin, fkid_ciudad } = req.query;

      const where = { baja_logica: false };

      if (fecha_inicio && fecha_fin) {
        where.fecha_ruta = {
          [Op.between]: [fecha_inicio, fecha_fin]
        };
      }

      if (fkid_ciudad) {
        where.fkid_ciudad = fkid_ciudad;
      }

      const rutas = await Ruta.findAll({
        where,
        include: [
          {
            model: RutaPedido,
            as: 'pedidos'
          }
        ]
      });

      const estadisticas = {
        total_rutas: rutas.length,
        rutas_por_estado: {},
        total_pedidos: 0,
        total_entregados: 0,
        distancia_total: 0,
        tiempo_total: 0
      };

      rutas.forEach(ruta => {
        // Contar por estado
        estadisticas.rutas_por_estado[ruta.estado] = 
          (estadisticas.rutas_por_estado[ruta.estado] || 0) + 1;

        // Sumar totales
        estadisticas.total_pedidos += ruta.total_pedidos;
        estadisticas.total_entregados += ruta.total_entregados;
        estadisticas.distancia_total += parseFloat(ruta.distancia_estimada || 0);
        estadisticas.tiempo_total += parseInt(ruta.tiempo_estimado || 0);
      });

      res.json({
        success: true,
        data: estadisticas
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Desasignar un pedido específico de una ruta
  async desasignarPedido(req, res) {
    try {
      const { id, pedidoId } = req.params;

      // Verificar que la ruta existe
      const ruta = await Ruta.findByPk(id);
      if (!ruta) {
        return res.status(404).json({
          success: false,
          message: 'Ruta no encontrada'
        });
      }

      // Verificar que el pedido está asignado a esta ruta
      const rutaPedido = await RutaPedido.findOne({
        where: {
          fkid_ruta: id,
          fkid_pedido: pedidoId
        },
        include: [
          {
            model: Pedido,
            as: 'pedido',
            include: [
              {
                model: Cliente,
                as: 'cliente'
              }
            ]
          }
        ]
      });

      if (!rutaPedido) {
        return res.status(404).json({
          success: false,
          message: 'El pedido no está asignado a esta ruta'
        });
      }

      // Verificar que la ruta no esté en progreso o completada
      if (ruta.estado === 'en_progreso' || ruta.estado === 'completada') {
        return res.status(400).json({
          success: false,
          message: 'No se puede desasignar pedidos de una ruta en progreso o completada'
        });
      }

      // Eliminar la asignación del pedido
      await rutaPedido.destroy();

      // Actualizar el total de pedidos en la ruta
      await ruta.update({
        total_pedidos: Math.max(0, ruta.total_pedidos - 1)
      });

      // Reordenar los pedidos restantes
      const pedidosRestantes = await RutaPedido.findAll({
        where: {
          fkid_ruta: id
        },
        order: [['orden_entrega', 'ASC']]
      });

      // Actualizar el orden de entrega de los pedidos restantes
      for (let i = 0; i < pedidosRestantes.length; i++) {
        await pedidosRestantes[i].update({
          orden_entrega: i + 1
        });
      }

      res.json({
        success: true,
        message: 'Pedido desasignado de la ruta exitosamente',
        data: {
          ruta_id: id,
          pedido_id: pedidoId,
          pedido_desasignado: {
            id: rutaPedido.id,
            pedido: rutaPedido.pedido,
            orden_entrega: rutaPedido.orden_entrega
          },
          total_pedidos_restantes: pedidosRestantes.length,
          total_pedidos_ruta: ruta.total_pedidos
        }
      });

    } catch (error) {
      console.error('Error al desasignar pedido:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }

  // Desasignar repartidor de una ruta
  async desasignarRepartidor(req, res) {
    try {
      const { id } = req.params;

      // Verificar que la ruta existe
      const ruta = await Ruta.findByPk(id, {
        include: [
          {
            model: Repartidor,
            as: 'repartidor',
            include: ['ciudad']
          },
          {
            model: City,
            as: 'ciudad'
          }
        ]
      });

      if (!ruta) {
        return res.status(404).json({
          success: false,
          message: 'Ruta no encontrada'
        });
      }

      // Verificar que la ruta tiene un repartidor asignado
      if (!ruta.fkid_repartidor) {
        return res.status(400).json({
          success: false,
          message: 'La ruta no tiene un repartidor asignado'
        });
      }

      // Verificar que la ruta no esté en progreso o completada
      if (ruta.estado === 'en_progreso' || ruta.estado === 'completada') {
        return res.status(400).json({
          success: false,
          message: 'No se puede desasignar el repartidor de una ruta en progreso o completada'
        });
      }

      // Guardar información del repartidor antes de desasignarlo
      const repartidorDesasignado = {
        id: ruta.repartidor.id,
        codigo_repartidor: ruta.repartidor.codigo_repartidor,
        nombre_completo: ruta.repartidor.nombre_completo,
        tipo_vehiculo: ruta.repartidor.tipo_vehiculo,
        estado: ruta.repartidor.estado
      };

      // Desasignar el repartidor (establecer como null)
      await ruta.update({
        fkid_repartidor: null
      });

      // Actualizar el estado del repartidor a disponible si estaba ocupado
      if (ruta.repartidor.estado === 'ocupado' || ruta.repartidor.estado === 'en_ruta') {
        await ruta.repartidor.update({
          estado: 'disponible'
        });
      }

      res.json({
        success: true,
        message: 'Repartidor desasignado de la ruta exitosamente',
        data: {
          ruta_id: id,
          ruta_nombre: ruta.nombre_ruta,
          repartidor_desasignado: repartidorDesasignado,
          ruta_actualizada: {
            id: ruta.id,
            nombre_ruta: ruta.nombre_ruta,
            fkid_repartidor: null,
            estado: ruta.estado,
            total_pedidos: ruta.total_pedidos
          }
        }
      });

    } catch (error) {
      console.error('Error al desasignar repartidor:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
}

module.exports = new RutaController();
