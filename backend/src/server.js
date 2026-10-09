import "dotenv/config";
import app from "./app.js";
import { connectToDatabase, ensureDefaultCategories } from "./config/db.js";

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  await connectToDatabase(process.env.MONGODB_URI);
  await ensureDefaultCategories();

  const port = Number(process.env.PORT ?? 4000);
  const server = app.listen(port, () => console.info(`Retain API listening on port ${port}.`));
  const shutdown = async (signal) => {
    console.info(`${signal} received; closing the server.`);
    server.close(async (error) => {
      if (error) {
        console.error("Server shutdown failed:", error);
        process.exitCode = 1;
      }
      const mongoose = await import("mongoose");
      await mongoose.default.disconnect();
    });
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error("Unable to start Retain API:", error);
  process.exitCode = 1;
});
