import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");

export const expenseInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  amount: z.coerce.number().finite().positive().max(1_000_000_000),
  category: objectIdSchema,
  date: z.coerce.date(),
  paymentMethod: z.enum(["cash", "card", "bank transfer", "mobile money", "other"]),
  notes: z.string().trim().max(500).optional().default("")
});

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
