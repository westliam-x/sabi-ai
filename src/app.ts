import express from "express";
import cors from "cors";
import whatsappRouter from "./routes/whatsapp.route";
import healthRouter from "./routes/health.route";

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true })); // Twilio sends URL-encoded bodies
app.use(express.json());

app.use("/health", healthRouter);
app.use("/webhook/whatsapp", whatsappRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
