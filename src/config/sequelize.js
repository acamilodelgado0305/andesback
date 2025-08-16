import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Creamos la instancia de Sequelize que usarán los nuevos controladores
const sequelize = new Sequelize(
    process.env.PGDATABASE, 
    process.env.PGUSER, 
    process.env.PGPASSWORD, 
    {
        host: process.env.PGHOST,
        dialect: 'postgres',
        port: 5432,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
        logging: false, // Ponlo en 'console.log' para ver las consultas que hace
    }
);

export default sequelize;