import express from "express";
import cors from "cors"; // Importa cors
import { PORT } from "./config.js";
import usersRoutes from "./routes/users.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import morgan from "morgan";
const path = require('path');
const app = express();
// Sirve los archivos estáticos de la carpeta 'build' (o 'dist' si usas Vite)
app.use(express.static(path.join(__dirname, 'build')));

// Para cualquier otra ruta, envía el index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
app.use(cors({ origin: ["http://localhost:3000","https://liceolibertador.netlify.app"] })); // Permite solicitudes desde el frontend
app.use(morgan("dev"));
app.use(express.json());
app.use(usersRoutes);
app.use(dashboardRoutes);

app.listen(PORT, () => {
  console.log("Server on port", PORT);
});
