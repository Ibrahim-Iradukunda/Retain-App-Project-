import { Router } from "express";
import Expense from "../models/Expense.js";
import User from "../models/User.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/insights", async (req, res) => {
  const [registeredUsers, expenseStats, categoryStats, recentUsers, recentExpenses] = await Promise.all([
    User.countDocuments(),
    Expense.aggregate([{ $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } }]),
    Expense.aggregate([
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: "$category" },
      { $project: { _id: 0, category: "$category.name", color: "$category.color", total: 1, count: 1 } }
    ]),
    User.find().select("name email createdAt").sort({ createdAt: -1 }).limit(5).lean(),
    Expense.find().populate("user", "name email").populate("category", "name").sort({ createdAt: -1 }).limit(5).lean()
  ]);

  res.json({
    registeredUsers,
    expenseCount: expenseStats[0]?.count ?? 0,
    totalSpending: expenseStats[0]?.total ?? 0,
    categoryStats,
    recentUsers,
    recentExpenses
  });
});

export default router;
