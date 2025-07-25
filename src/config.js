
import dotenv from 'dotenv';
dotenv.config();
export const PORT = process.env.PORT || 4000;
export const DB_USER = process.env.DB_USER
export const DB_HOST = process.env.DB_HOST
export const DB_PASSWORD = process.env.DB_PASSWORD
export const DB_DATABASE = process.env.DB_DATABASE
export const DB_PORT = process.env.DB_PORT
export const JWT_SECRET = process.env.JWT_SECRET
export const URL_FRONT = process.env.URL_FRONT

