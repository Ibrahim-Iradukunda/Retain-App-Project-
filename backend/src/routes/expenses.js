import { Router } from "express";
import Expense from "../models/Expense.js";
import { requireAuth } from "../middleware/auth.js";
import { escapeRegex, expenseInputSchema, objectIdSchema } from "../utils/validation.js";
import { z } from "zod";

const router = Router();
const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: objectIdSchema.optional(),
  paymentMethod: z.enum(["cash", "card", "bank transfer", "mobile money", "other"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(["date", "amount"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc")
});

router.get("/", requireAuth, async (req, res) => {
  const query = listSchema.parse(req.query);
  if (query.from && query.to && query.from > query.to) {
    return res.status(400).json({ message: "The start date must be before the end date." });
  }
  if (query.minAmount !== undefined && query.maxAmount !== undefined && query.minAmount > query.maxAmount) {
    return res.status(400).json({ message: "The minimum amount cannot exceed the maximum amount." });
  }

  const filter = { user: req.user.id };
  if (query.category) filter.category = query.category;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) filter.date.$lte = query.to;
  }
  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    filter.amount = {};
    if (query.minAmount !== undefined) filter.amount.$gte = query.minAmount;
    if (query.maxAmount !== undefined) filter.amount.$lte = query.maxAmount;
  }
  if (query.search) filter.title = { $regex: escapeRegex(query.search), $options: "i" };

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .populate("category", "name slug color")
      .sort({ [query.sortBy]: query.order === "asc" ? 1 : -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Expense.countDocuments(filter)
  ]);
  res.json({
    expenses,
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) }
  });
});

router.post("/", requireAuth, async (req, res) => {
  const input = expenseInputSchema.parse(req.body);
  const expense = await Expense.create({ ...input, user: req.user.id });
  await expense.populate("category", "name slug color");
  res.status(201).json({ expense });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const id = objectIdSchema.parse(req.params.id);
  const input = expenseInputSchema.partial().refine((value) => Object.keys(value).length > 0);
  const expense = await Expense.findOneAndUpdate(
    { _id: id, user: req.user.id },
    input.parse(req.body),
    { new: true, runValidators: true }
  ).populate("category", "name slug color");
  if (!expense) {
    return res.status(404).json({ message: "Expense not found." });
  }
  return res.json({ expense });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const id = objectIdSchema.parse(req.params.id);
  const expense = await Expense.findOneAndDelete({ _id: id, user: req.user.id });
  if (!expense) {
    return res.status(404).json({ message: "Expense not found." });
  }
  return res.status(204).end();
});

export default router;
