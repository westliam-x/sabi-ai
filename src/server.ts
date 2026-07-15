import "dotenv/config";
import app from "./app";
import { connectDB } from "./db/mongo";
import { startReminderScheduler } from "./services/reminder.service";
import { logger } from "./utils/logger";

const PORT = Number(process.env.PORT || 4000);

const start = async () => {
  await connectDB();
  startReminderScheduler();

  app.listen(PORT, () => {
    logger.info("server.started", { port: PORT, env: process.env.NODE_ENV || "development" });
  });
};

start().catch((err) => {
  logger.error("server.fatal", { err });
  process.exit(1);
});
