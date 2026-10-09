import "dotenv/config";
import app from "./app.js";
import { connectToDatabase } from "./config/db.js";
import Category from "./models/Category.js";

const defaultCategories = [
  ["Food", "#e69f6a"],
  ["Transport", "#6d9dc5"],
  ["Housing", "#8e7cc3"],
  ["Utilities", "#d8b65c"],
  ["Shopping", "#d87991"],
  ["Entertainment", "#8caa74"],
  ["Healthcare", "#65a89b"]
];

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  await connectToDatabase(process.env.MONGODB_URI);
  await Promise.all(defaultCategories.map(([name, color]) => {
    const slug = name.toLowerCase();
    return Category.updateOne({ slug }, { $setOnInsert: { name, slug, color } }, { upsert: true });
  }));

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
