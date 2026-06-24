// Aplica la migración de Paz y Salvo (columnas en la tabla students).
// Uso:  node apply_paz_salvo_migration.js
import pool from './src/database.js';

async function applyMigration() {
  const columns = [
    { name: 'paz_salvo_academico', ddl: 'BOOLEAN NOT NULL DEFAULT FALSE' },
    { name: 'paz_salvo_financiero', ddl: 'BOOLEAN NOT NULL DEFAULT FALSE' },
    { name: 'paz_salvo_academico_fecha', ddl: 'TIMESTAMPTZ NULL' },
    { name: 'paz_salvo_financiero_fecha', ddl: 'TIMESTAMPTZ NULL' },
  ];

  try {
    for (const col of columns) {
      const res = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'students' AND column_name = $1;`,
        [col.name]
      );

      if (res.rows.length === 0) {
        console.log(`Agregando columna '${col.name}'...`);
        await pool.query(`ALTER TABLE students ADD COLUMN ${col.name} ${col.ddl};`);
        console.log(`  -> Columna '${col.name}' agregada.`);
      } else {
        console.log(`La columna '${col.name}' ya existe. Omitiendo.`);
      }
    }
    console.log('Migración de Paz y Salvo completada.');
  } catch (err) {
    console.error('Error aplicando la migración de Paz y Salvo:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

applyMigration();
