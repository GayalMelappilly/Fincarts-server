import pkg from 'pg';
const { Pool } = pkg;
import { configDotenv } from "dotenv";
configDotenv();

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: { rejectUnauthorized: false }
});

export default pool;
