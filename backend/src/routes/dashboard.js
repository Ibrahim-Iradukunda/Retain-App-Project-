import { Router } from "express";
import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();
const monthSchema = z.object({
  year: z.coerce.number().int().min(2000).max(9999).default(new Date().getFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1)
});

router.get("/", requireAuth, async (req, res) => {
  const { year, month } = monthSchema.parse(req.query);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const match = { user: req.user._id, date: { $gte: start, $lt: end } };
  const [totals, byCategory, recentExpenses, budget] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 }, highest: { $max: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: match },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: "$category" },
      { $project: { _id: 0, category: "$category.name", color: "$category.color", total: 1, count: 1 } }
    ]),
    Expense.find(match).populate("category", "name color").sort({ date: -1, _id: -1 }).limit(5).lean(),
    Budget.findOne({ user: req.user.id, year, month }).lean()
  ]);
  const totalSpent = totals[0]?.total ?? 0;
  const budgetAmount = budget?.amount ?? 0;
  const remaining = budgetAmount - totalSpent;
  const budgetStatus = budgetAmount === 0 ? "not-set" : remaining < 0 ? "over" : remaining <= budgetAmount * 0.2 ? "approaching" : "within";

  res.json({
    year,
    month,
    totalSpent,
    expenseCount: totals[0]?.count ?? 0,
    highestExpense: totals[0]?.highest ?? 0,
    budget: budgetAmount,
    remaining,
    budgetStatus,
    byCategory,
    recentExpenses
  });
});

export default router;
