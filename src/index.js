import express from "express";
import cors from "cors";
import { PORT } from "./config.js";
import usersRoutes from "./routes/users.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import morgan from "morgan";
// Importa las funciones necesarias para manejar rutas en ES Modules

const app = express();

// --- Manejo de __dirname en ES Modules --
app.use(cors({ origin: ["http://localhost:3000","https://liceolibertador.netlify.app"] }));
app.use(morgan("dev"));
app.use(express.json());
app.use(usersRoutes);
app.use(dashboardRoutes);

app.listen(PORT, () => {
  console.log("Server on port", PORT);
});
