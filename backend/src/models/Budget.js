import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true, min: 2000, max: 9999 },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0.01 }
  },
  { timestamps: true }
);

budgetSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model("Budget", budgetSchema);
