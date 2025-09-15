const { User, Role, City, Pedido } = require('../../models');
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
      if (ciudad_id) {
        whereClause.ciudad_id = ciudad_id;
      }

      // Búsqueda por nombre o email
      if (search) {
        whereClause[Op.or] = [
          { nombre_completo: { [Op.like]: `%${search}%` } },
          { correo_electronico: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: clientes } = await User.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'user' }, // Solo usuarios con rol user (clientes)
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: { exclude: ['contrasena'] } // Excluir contraseña
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
      
      const cliente = await User.findByPk(id, {
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'user' },
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        attributes: { exclude: ['contrasena'] }
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
        correo_electronico,
        ciudad_id,
        contrasena = 'cliente123' // Contraseña por defecto
      } = req.body;

      // Verificar que el email no exista
      const existingUser = await User.findOne({
        where: { correo_electronico }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con ese correo electrónico'
        });
      }

      // Obtener el rol de usuario (cliente)
      const rolCliente = await Role.findOne({
        where: { nombre: 'user' }
      });

      if (!rolCliente) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró el rol de usuario'
        });
      }

      // Verificar que la ciudad existe
      const ciudad = await City.findByPk(ciudad_id);
      if (!ciudad) {
        return res.status(400).json({
          success: false,
          message: 'La ciudad especificada no existe'
        });
      }

      const cliente = await User.create({
        nombre_completo,
        correo_electronico,
        contrasena,
        rol_id: rolCliente.id,
        ciudad_id
      });

      // Obtener el cliente creado con sus relaciones
      const clienteCompleto = await User.findByPk(cliente.id, {
        include: [
          {
            model: Role,
            as: 'rol',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        attributes: { exclude: ['contrasena'] }
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

      const cliente = await User.findByPk(id, {
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'cliente' }
          }
        ]
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Verificar que el nuevo email no exista (si se está cambiando)
      if (updateData.correo_electronico && updateData.correo_electronico !== cliente.correo_electronico) {
        const existingUser = await User.findOne({
          where: { 
            correo_electronico: updateData.correo_electronico,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un usuario con ese correo electrónico'
          });
        }
      }

      // Verificar que la ciudad existe (si se está cambiando)
      if (updateData.ciudad_id) {
        const ciudad = await City.findByPk(updateData.ciudad_id);
        if (!ciudad) {
          return res.status(400).json({
            success: false,
            message: 'La ciudad especificada no existe'
          });
        }
      }

      await cliente.update(updateData);

      // Obtener el cliente actualizado con sus relaciones
      const clienteActualizado = await User.findByPk(id, {
        include: [
          {
            model: Role,
            as: 'rol',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        attributes: { exclude: ['contrasena'] }
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

      const cliente = await User.findByPk(id, {
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'cliente' }
          }
        ]
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      await cliente.update({ isActive: false });

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

      const cliente = await User.findByPk(id, {
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'cliente' }
          }
        ]
      });
      
      if (!cliente) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      await cliente.update({ isActive: true });

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
      const totalClientes = await User.count({
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'cliente' }
          }
        ],
        where: { isActive: true }
      });

      const clientesActivos = await User.count({
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'cliente' }
          }
        ],
        where: { isActive: true }
      });

      const clientesInactivos = await User.count({
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'cliente' }
          }
        ],
        where: { isActive: false }
      });

      // Clientes por ciudad
      const clientesByCiudad = await User.findAll({
        attributes: [
          'ciudad_id',
          [User.sequelize.fn('COUNT', User.sequelize.col('User.id')), 'count']
        ],
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'user' },
            attributes: []
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['nombre', 'departamento']
          }
        ],
        where: { isActive: true },
        group: ['ciudad_id', 'ciudad.id'],
        order: [[User.sequelize.fn('COUNT', User.sequelize.col('User.id')), 'DESC']]
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
      const clientes = await User.findAll({
        include: [
          {
            model: Role,
            as: 'rol',
            where: { nombre: 'user' },
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        where: { isActive: true },
        order: [['nombre_completo', 'ASC']],
        attributes: { exclude: ['contrasena'] }
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
