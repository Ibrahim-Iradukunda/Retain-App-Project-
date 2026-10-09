import { Router } from "express";
import Category from "../models/Category.js";
import Expense from "../models/Expense.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { objectIdSchema } from "../utils/validation.js";
import { z } from "zod";

const router = Router();
const categorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

router.get("/", requireAuth, async (req, res) => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  res.json({ categories });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = categorySchema.parse(req.body);
  const category = await Category.create({
    ...input,
    slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  });
  res.status(201).json({ category });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = objectIdSchema.parse(req.params.id);
  const input = categorySchema.partial().refine((value) => Object.keys(value).length > 0);
  const updates = input.parse(req.body);
  const category = await Category.findByIdAndUpdate(
    id,
    {
      ...updates,
      ...(updates.name && {
        slug: updates.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      })
    },
    { new: true, runValidators: true }
  );
  if (!category) {
    return res.status(404).json({ message: "Category not found." });
  }
  return res.json({ category });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = objectIdSchema.parse(req.params.id);
  if (await Expense.exists({ category: id })) {
    return res.status(409).json({ message: "This category is in use and cannot be deleted." });
  }
  const category = await Category.findByIdAndDelete(id);
  if (!category) {
    return res.status(404).json({ message: "Category not found." });
  }
  return res.status(204).end();
});

export default router;
