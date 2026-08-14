import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const {Pool} = pg;
const pool = new Pool({
    host:process.env.DB_HOST,
    database:process.env.DB_DATABASE,
    port:process.env.DB_PORT,
    password:process.env.DB_PASSWORD,
    user:process.env.DB_USER,
    

});
export default pool;