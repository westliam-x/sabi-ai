import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "sabi",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    ts: new Date().toISOString(),
  });
});

export default router;
