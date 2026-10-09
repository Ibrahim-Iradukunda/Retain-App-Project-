import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    color: { type: String, default: "#6b8f71", match: /^#[0-9a-fA-F]{6}$/ }
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
