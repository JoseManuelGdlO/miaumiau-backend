module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define('RolePermission', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    permission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'permissions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    }
  }, {
    tableName: 'role_permissions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['role_id', 'permission_id']
      },
      {
        fields: ['role_id']
      },
      {
        fields: ['permission_id']
      }
    ]
  });

  // Métodos estáticos
  RolePermission.findByRole = function(roleId) {
    return this.findAll({
      where: { role_id: roleId },
      include: [
        {
          model: sequelize.models.Permission,
          as: 'permission'
        }
      ]
    });
  };

  RolePermission.findByPermission = function(permissionId) {
    return this.findAll({
      where: { permission_id: permissionId },
      include: [
        {
          model: sequelize.models.Role,
          as: 'role'
        }
      ]
    });
  };

  RolePermission.assignPermissionToRole = async function(roleId, permissionId) {
    const [rolePermission, created] = await this.findOrCreate({
      where: {
        role_id: roleId,
        permission_id: permissionId
      }
    });
    return { rolePermission, created };
  };

  RolePermission.removePermissionFromRole = async function(roleId, permissionId) {
    return await this.destroy({
      where: {
        role_id: roleId,
        permission_id: permissionId
      }
    });
  };

  RolePermission.syncRolePermissions = async function(roleId, permissionIds) {
    // Eliminar todas las asignaciones actuales del rol
    await this.destroy({
      where: { role_id: roleId }
    });

    // Crear las nuevas asignaciones
    if (permissionIds && permissionIds.length > 0) {
      const rolePermissions = permissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId
      }));
      
      await this.bulkCreate(rolePermissions);
    }
  };

  return RolePermission;
};
