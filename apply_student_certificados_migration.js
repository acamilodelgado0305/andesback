// Aplica la migración de certificados del estudiante (tabla student_certificados).
// Usa la MISMA conexión que la app (src/database.js + .env), así que corre donde
// corre tu backend. El SQL es idempotente (CREATE TABLE IF NOT EXISTS).
// Uso:  node apply_student_certificados_migration.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './src/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyMigration() {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migration_student_certificados.sql'),
      'utf8'
    );
    console.log('Aplicando migration_student_certificados.sql...');
    await pool.query(sql);
    console.log('  -> Tabla student_certificados lista.');
    console.log('Migración de certificados del estudiante completada.');
  } catch (err) {
    console.error('Error aplicando la migración de certificados del estudiante:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

applyMigration();
