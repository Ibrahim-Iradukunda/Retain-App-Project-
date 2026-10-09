const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export type User = { id: string; name: string; email: string; role: "user" | "admin" };
export type Category = { _id: string; name: string; slug: string; color: string };
export type Expense = {
  _id: string;
  title: string;
  amount: number;
  category: Category;
  date: string;
  paymentMethod: string;
  notes: string;
};
export type Dashboard = {
  year: number;
  month: number;
  totalSpent: number;
  expenseCount: number;
  highestExpense: number;
  budget: number;
  remaining: number;
  budgetStatus: "not-set" | "over" | "approaching" | "within";
  byCategory: { category: string; color: string; total: number; count: number }[];
  recentExpenses: Expense[];
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("retain-token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      localStorage.removeItem("retain-token");
      localStorage.removeItem("retain-user");
      window.dispatchEvent(new Event("retain:unauthorized"));
    }
    throw new ApiError(body.message ?? "Something went wrong. Please try again.", response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function currency(amount: number) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0
  }).format(amount);
}

export function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}
