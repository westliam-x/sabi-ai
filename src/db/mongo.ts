import mongoose from "mongoose";
import { logger } from "../utils/logger";

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set");

  try {
    await mongoose.connect(uri);
    logger.info("db.connected", { uri: uri.replace(/\/\/.*@/, "//***@") });
  } catch (err) {
    logger.error("db.connection_failed", { err });
    process.exit(1);
  }
};
