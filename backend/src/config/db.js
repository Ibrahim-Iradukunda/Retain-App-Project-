import mongoose from "mongoose";
import User from "../models/User.js";
import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import Category from "../models/Category.js";

export async function connectToDatabase(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }

  mongoose.set("strictQuery", true);
  // Fail fast (instead of hanging the request) when the cluster is unreachable,
  // e.g. when the MongoDB Atlas IP Access List does not allow the server.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  await Promise.all([
    User.init(),
    Expense.init(),
    Budget.init(),
    Category.init()
  ]);
  console.info(`Connected to MongoDB database "${mongoose.connection.name}".`);
}

const defaultCategories = [
  ["Food", "#e69f6a"],
  ["Transport", "#6d9dc5"],
  ["Housing", "#8e7cc3"],
  ["Utilities", "#d8b65c"],
  ["Shopping", "#d87991"],
  ["Entertainment", "#8caa74"],
  ["Healthcare", "#65a89b"]
];

export async function ensureDefaultCategories() {
  await Promise.all(defaultCategories.map(([name, color]) => {
    const slug = name.toLowerCase();
    return Category.updateOne({ slug }, { $setOnInsert: { name, slug, color } }, { upsert: true });
  }));
}
