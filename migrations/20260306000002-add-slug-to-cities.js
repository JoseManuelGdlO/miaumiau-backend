'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('cities', 'slug', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Slug para URLs del catálogo por ciudad (ej. DURANGO, CDMX)'
    });

    const [rows] = await queryInterface.sequelize.query(
      'SELECT id, nombre FROM cities'
    );

    const slugCount = {};
    for (const row of rows) {
      const raw = (row.nombre || '')
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 50);
      const base = raw || `CIUDAD_${row.id}`;
      let slug = base;
      if (slugCount[base]) {
        slugCount[base]++;
        slug = `${base}_${slugCount[base]}`;
      } else {
        slugCount[base] = 1;
      }
      await queryInterface.sequelize.query(
        'UPDATE cities SET slug = :slug WHERE id = :id',
        { replacements: { slug, id: row.id } }
      );
    }

    await queryInterface.changeColumn('cities', 'slug', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addIndex('cities', ['slug'], { unique: true, name: 'idx_cities_slug' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('cities', 'idx_cities_slug');
    await queryInterface.removeColumn('cities', 'slug');
  }
};
