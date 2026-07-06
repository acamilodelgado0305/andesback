// Aplica la migración de presentaciones de clase (tabla clase_presentaciones).
// Usa la MISMA conexión que la app (src/database.js + .env), así que corre donde
// corre tu backend. El SQL es idempotente (CREATE TABLE IF NOT EXISTS).
// Uso:  node apply_clase_presentaciones_migration.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './src/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration() {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migration_clase_presentaciones.sql'),
      'utf8'
    );
    console.log('Aplicando migration_clase_presentaciones.sql...');
    await pool.query(sql);
    console.log('  -> Tabla clase_presentaciones lista.');
    console.log('Migración de presentaciones de clase completada.');
  } catch (err) {
    console.error('Error aplicando la migración de presentaciones de clase:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

applyMigration();
