
import pool from './src/database.js';

async function checkSchema() {
    try {
        // Set a timeout to avoid hanging forever
        const timeout = setTimeout(() => {
            console.error("Timeout reached, exiting...");
            process.exit(1);
        }, 5000);

        console.log("Querying users table schema...");
        const res = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);

        console.log("Columns found:");
        if (res.rows.length === 0) {
            console.log("No columns found for table 'users'. Does the table exist?");
        } else {
            console.log(res.rows.map(r => r.column_name).join(", "));
        }
        clearTimeout(timeout);
    } catch (err) {
        console.error("Error executing query:", err);
    } finally {
        console.log("Closing pool...");
        await pool.end(); // Make sure to close the pool
        process.exit(0);
    }
}

checkSchema();
