import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    date: { type: Date, required: true },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["cash", "card", "bank transfer", "mobile money", "other"]
    },
    notes: { type: String, trim: true, maxlength: 500, default: "" }
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, date: -1 });

export default mongoose.model("Expense", expenseSchema);
