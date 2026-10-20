'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventario_vehiculo', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fkid_producto: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inventarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      cantidad: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('inventario_vehiculo', ['fkid_repartidor', 'nombre'], {
      unique: true,
      name: 'inventario_vehiculo_repartidor_nombre',
    });

    await queryInterface.createTable('movimientos_inventario_vehiculo', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      fkid_repartidor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'repartidores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      fkid_producto: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'inventarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      tipo: {
        type: Sequelize.ENUM('carga', 'entrega', 'devolucion', 'ajuste'),
        allowNull: false,
      },
      cantidad: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      fkid_jornada: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'jornadas_repartidor', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      fkid_pedido: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addColumn('jornadas_repartidor', 'efectivo_cobrado', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('jornadas_repartidor', 'virtual_cobrado', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('jornadas_repartidor', 'valor_carga', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jornadas_repartidor', 'valor_carga');
    await queryInterface.removeColumn('jornadas_repartidor', 'virtual_cobrado');
    await queryInterface.removeColumn('jornadas_repartidor', 'efectivo_cobrado');
    await queryInterface.dropTable('movimientos_inventario_vehiculo');
    await queryInterface.dropTable('inventario_vehiculo');
  },
};
