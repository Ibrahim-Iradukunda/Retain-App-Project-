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
  await mongoose.connect(uri);
  await Promise.all([
    User.init(),
    Expense.init(),
    Budget.init(),
    Category.init()
  ]);
  console.info(`Connected to MongoDB database "${mongoose.connection.name}".`);
}
