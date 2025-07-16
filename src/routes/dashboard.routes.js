import { Router } from "express";
import {
  stats,
  students,
  metrics,
} from "../controllers/dashboard.controllers.js";

const router = Router();

router.get("/stats", stats);
router.get("/students", students);
router.get("/metrics", metrics);

export default router;
