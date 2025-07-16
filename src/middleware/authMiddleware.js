import jwt from "jsonwebtoken";
import {JWT_SECRET} from "../config.js"
export const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(403).json({ mensaje: "Acceso denegado. No hay token" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET); //  Cambia "secreto" por una variable de entorno segura
        req.user = decoded; //  Ahora req.user tendrá { id_docente, rol }
        console.log("Usuario autenticado:", req.user); //  Depuración
        next();
    } catch (error) {
        console.log("Token invalido o expirado");
        return res.status(401).json({ mensaje: "Token invalido o expirado" });
    }
};