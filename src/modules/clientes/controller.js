const { Cliente, Mascota, City, Pedido } = require('../../models');
const { Op } = require('sequelize');

class ClienteController {
  // Obtener todos los clientes
  async getAllClientes(req, res, next) {
    try {
      const { 
        activos = 'true', 
        ciudad_id, 
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.isActive = true;
      } else if (activos === 'false') {
        whereClause.isActive = false;
      }
      
      // Filtrar por ciudad
      const fkidCiudadQuery = ciudad_id ?? req.query.fkid_ciudad;
      if (fkidCiudadQuery) {
        whereClause.fkid_ciudad = fkidCiudadQuery;
      }

      // Búsqueda por nombre o email
      if (search) {
        whereClause[Op.or] = [
          { nombre_completo: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: clientes } = await Cliente.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Obtener estadísticas adicionales para cada cliente
      const clientesConStats = await Promise.all(
        clientes.map(async (cliente) => {
          // Contar pedidos del cliente
          const totalPedidos = await Pedido.count({
            where: { fkid_cliente: cliente.id }
          });

          // Obtener último pedido
          const ultimoPedido = await Pedido.findOne({
            where: { fkid_cliente: cliente.id },
            order: [['fecha_pedido', 'DESC']],
            attributes: ['fecha_pedido', 'estado']
          });

          // Calcular total gastado
          const totalGastado = await Pedido.sum('total', {
            where: { 
              fkid_cliente: cliente.id,
              estado: { [Op.in]: ['entregado', 'confirmado', 'en_preparacion', 'en_camino'] }
            }
          });

          return {
            ...cliente.toJSON(),
            totalPedidos: totalPedidos || 0,
            ultimoPedido: ultimoPedido ? ultimoPedido.fecha_pedido : null,
            totalGastado: totalGastado || 0,
            loyaltyPoints: Math.floor((totalGastado || 0) / 100) // 1 punto por cada $100
          };
        })
      );

      res.json({
        success: true,
        data: {
          clientes: clientesConStats,
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

  // Obtener un cliente por ID
  async getClienteById(req, res, next) {
    try {
      const { id } = req.params;
      
      const cliente = await Cliente.findByPk(id, {
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza', 'producto_preferido', 'puntos_lealtad', 'notas_especiales']
          }
        ]
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Obtener estadísticas del cliente
      const totalPedidos = await Pedido.count({
        where: { fkid_cliente: cliente.id }
      });

      const ultimoPedido = await Pedido.findOne({
        where: { fkid_cliente: cliente.id },
        order: [['fecha_pedido', 'DESC']],
        attributes: ['fecha_pedido', 'estado', 'total']
      });

      const totalGastado = await Pedido.sum('total', {
        where: { 
          fkid_cliente: cliente.id,
          estado: { [Op.in]: ['entregado', 'confirmado', 'en_preparacion', 'en_camino'] }
        }
      });

      const clienteConStats = {
        ...cliente.toJSON(),
        totalPedidos: totalPedidos || 0,
        ultimoPedido: ultimoPedido ? ultimoPedido.fecha_pedido : null,
        totalGastado: totalGastado || 0,
        loyaltyPoints: Math.floor((totalGastado || 0) / 100)
      };

      res.json({
        success: true,
        data: { cliente: clienteConStats }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo cliente
  async createCliente(req, res, next) {
    try {
      const {
        nombre_completo,
        telefono,
        canal_contacto,
        direccion_entrega,
        notas_especiales
      } = req.body;
      const email = req.body.email ?? req.body.correo_electronico;
      const fkid_ciudad = req.body.fkid_ciudad ?? req.body.ciudad_id;

      // Verificar que el email no exista (si se proporciona)
      if (email) {
        const existingCliente = await Cliente.findOne({
          where: { email }
        });

        if (existingCliente) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un cliente con ese correo electrónico'
          });
        }
      }

      // Verificar que el teléfono no exista
      const existingPhone = await Cliente.findOne({
        where: { telefono }
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un cliente con ese número de teléfono'
        });
      }

      // Verificar que la ciudad existe
      const ciudad = await City.findByPk(fkid_ciudad);
      if (!ciudad) {
        return res.status(400).json({
          success: false,
          message: 'La ciudad especificada no existe'
        });
      }

      const cliente = await Cliente.create({
        nombre_completo,
        telefono,
        email,
        fkid_ciudad,
        canal_contacto,
        direccion_entrega,
        notas_especiales
      });

      // Obtener el cliente creado con sus relaciones
      const clienteCompleto = await Cliente.findByPk(cliente.id, {
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: { cliente: clienteCompleto }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar cliente
  async updateCliente(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const cliente = await Cliente.findByPk(id);
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Verificar que el nuevo email no exista (si se está cambiando)
      const updateEmail = updateData.email ?? updateData.correo_electronico;
      if (updateEmail && updateEmail !== cliente.email) {
        const existingCliente = await Cliente.findOne({
          where: { 
            email: updateEmail,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingCliente) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un cliente con ese correo electrónico'
          });
        }
      }

      // Verificar que el nuevo teléfono no exista (si se está cambiando)
      if (updateData.telefono && updateData.telefono !== cliente.telefono) {
        const existingPhone = await Cliente.findOne({
          where: { 
            telefono: updateData.telefono,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingPhone) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un cliente con ese número de teléfono'
          });
        }
      }

      // Verificar que la ciudad existe (si se está cambiando)
      const updateCiudadId = updateData.fkid_ciudad ?? updateData.ciudad_id;
      if (updateCiudadId) {
        const ciudad = await City.findByPk(updateCiudadId);
        if (!ciudad) {
          return res.status(400).json({
            success: false,
            message: 'La ciudad especificada no existe'
          });
        }
      }

      await cliente.update({
        ...updateData,
        email: updateEmail ?? cliente.email,
        fkid_ciudad: updateCiudadId ?? cliente.fkid_ciudad
      });

      // Obtener el cliente actualizado con sus relaciones
      const clienteActualizado = await Cliente.findByPk(id, {
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza']
          }
        ]
      });

      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: { cliente: clienteActualizado }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar cliente (baja lógica)
  async deleteCliente(req, res, next) {
    try {
      const { id } = req.params;

      const cliente = await Cliente.findByPk(id);
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      await cliente.softDelete();

      res.json({
        success: true,
        message: 'Cliente eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar cliente
  async restoreCliente(req, res, next) {
    try {
      const { id } = req.params;

      const cliente = await Cliente.findByPk(id);
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      await cliente.restore();

      res.json({
        success: true,
        message: 'Cliente restaurado exitosamente',
        data: { cliente }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de clientes
  async getClienteStats(req, res, next) {
    try {
      const totalClientes = await Cliente.count({
        where: { isActive: true }
      });

      const clientesActivos = await Cliente.count({
        where: { isActive: true }
      });

      const clientesInactivos = await Cliente.count({
        where: { isActive: false }
      });

      // Clientes por ciudad
      const clientesByCiudad = await Cliente.findAll({
        attributes: [
          'fkid_ciudad',
          [Cliente.sequelize.fn('COUNT', Cliente.sequelize.col('Cliente.id')), 'count']
        ],
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['nombre', 'departamento']
          }
        ],
        where: { isActive: true },
        group: ['fkid_ciudad', 'ciudad.id'],
        order: [[Cliente.sequelize.fn('COUNT', Cliente.sequelize.col('Cliente.id')), 'DESC']]
      });

      res.json({
        success: true,
        data: {
          totalClientes,
          clientesActivos,
          clientesInactivos,
          clientesByCiudad
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener clientes activos
  async getActiveClientes(req, res, next) {
    try {
      const clientes = await Cliente.findAll({
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Mascota,
            as: 'mascotas',
            where: { isActive: true },
            required: false,
            attributes: ['id', 'nombre', 'edad', 'genero', 'raza']
          }
        ],
        where: { isActive: true },
        order: [['nombre_completo', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          clientes,
          total: clientes.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClienteController();
