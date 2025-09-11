const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre_completo: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        len: [2, 150],
        notEmpty: true
      }
    },
    correo_electronico: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    rol_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    ciudad_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'cities',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    },
    contrasena: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [6, 255],
        notEmpty: true
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'isActive'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'lastLogin'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.contrasena) {
          user.contrasena = await bcrypt.hash(user.contrasena, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('contrasena')) {
          user.contrasena = await bcrypt.hash(user.contrasena, 12);
        }
      }
    },
    indexes: [
      {
        fields: ['rol_id']
      },
      {
        fields: ['ciudad_id']
      },
      {
        fields: ['correo_electronico'],
        unique: true
      }
    ]
  });

  // Métodos de instancia
  User.prototype.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.contrasena);
  };

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.contrasena;
    return values;
  };

  // Métodos estáticos
  User.findByEmail = function(email) {
    return this.findOne({ where: { correo_electronico: email } });
  };

  User.findByRole = function(rol_id) {
    return this.findAll({
      where: { rol_id },
      order: [['nombre_completo', 'ASC']]
    });
  };

  User.findByCity = function(ciudad_id) {
    return this.findAll({
      where: { ciudad_id },
      order: [['nombre_completo', 'ASC']]
    });
  };

  User.findActive = function() {
    return this.findAll({
      where: { isActive: true },
      order: [['nombre_completo', 'ASC']]
    });
  };

  return User;
};
