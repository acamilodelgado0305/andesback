import pool from './src/database.js';

async function fixSchema() {
    try {
        console.log("Checking if 'business_id' column exists in 'estudiantes' table...");
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'estudiantes' AND column_name = 'business_id';
    `);

        if (res.rows.length === 0) {
            console.log("Column 'business_id' is missing. Adding it now...");
            try {
                await pool.query(`
          ALTER TABLE estudiantes 
          ADD COLUMN business_id INTEGER;
        `);
                console.log("Column 'business_id' added successfully to 'estudiantes'.");
            } catch (alterErr) {
                console.error("Error adding column:", alterErr.message);
            }
        } else {
            console.log("Column 'business_id' already exists in 'estudiantes'.");
        }

    } catch (err) {
        console.error("Error checking schema:", err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

fixSchema();
