import express from "express";
import cors from "cors"; // Importa cors
import { PORT } from "./config.js";
import usersRoutes from "./routes/users.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import morgan from "morgan";

const app = express();

app.use(cors({ origin: "http://localhost:3000" })); // Permite solicitudes desde el frontend
app.use(morgan("dev"));
app.use(express.json());
app.use(usersRoutes);
app.use(dashboardRoutes);

app.listen(PORT, () => {
  console.log("Server on port", PORT);
});
