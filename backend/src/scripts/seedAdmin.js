import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../config/db.js";
import User from "../models/User.js";

async function main() {
  if (!process.env.MONGODB_URI || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error("MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD must be set.");
  }
  if (process.env.ADMIN_PASSWORD.length < 14) {
    throw new Error("ADMIN_PASSWORD must be at least 14 characters.");
  }
  await connectToDatabase(process.env.MONGODB_URI);

  const email = process.env.ADMIN_EMAIL.toLowerCase();
  const user = await User.findOne({ email });
  if (user) {
    user.role = "admin";
    user.passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await user.save();
  } else {
    await User.create({
      name: "Retain Administrator",
      email,
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
      role: "admin"
    });
  }
  console.info(`Administrator account ready for ${email}.`);
}

main()
  .catch((error) => {
    console.error("Administrator setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await import("mongoose")).default.disconnect();
  });
