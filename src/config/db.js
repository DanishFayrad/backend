import pg from 'pg';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();
const databaseUrl = process.env.DATABASE_URL || process.env.HEROKU_POSTGRESQL_PINK_URL;
if (!databaseUrl) {
    throw new Error('Database URL (DATABASE_URL or HEROKU_POSTGRESQL_PINK_URL) is not defined in environment variables');
}
const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectModule: pg,
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        },
        family: 4
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});
export default sequelize;
//# sourceMappingURL=db.js.map