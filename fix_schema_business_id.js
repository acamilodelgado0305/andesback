
import pool from './src/database.js';

async function fixSchema() {
    try {
        console.log("Checking if 'business_id' column exists in 'users' table...");
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'business_id';
    `);

        if (res.rows.length === 0) {
            console.log("Column 'business_id' is missing. Adding it now...");
            try {
                await pool.query(`
          ALTER TABLE users 
          ADD COLUMN business_id INTEGER;
        `);
                // Optionally add FK constraint if businesses table exists
                // await pool.query(`ALTER TABLE users ADD CONSTRAINT fk_user_business FOREIGN KEY (business_id) REFERENCES businesses(id);`);
                console.log("Column 'business_id' added successfully.");
            } catch (alterErr) {
                console.error("Error adding column:", alterErr.message);
            }
        } else {
            console.log("Column 'business_id' already exists.");
        }

    } catch (err) {
        console.error("Error checking schema:", err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

fixSchema();
