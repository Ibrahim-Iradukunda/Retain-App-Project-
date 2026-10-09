import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const signUpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128)
});
const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

function createToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

router.post("/signup", async (req, res) => {
  const input = signUpSchema.parse(req.body);
  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: await bcrypt.hash(input.password, 12)
  });
  return res.status(201).json({ token: createToken(user), user: publicUser(user) });
});

router.post("/signin", async (req, res) => {
  const input = signInSchema.parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select("+passwordHash");
  if (!user || !(await user.verifyPassword(input.password))) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  return res.json({ token: createToken(user), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
