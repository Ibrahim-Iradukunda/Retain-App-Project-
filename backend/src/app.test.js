import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "./app.js";
import { escapeRegex, expenseInputSchema } from "./utils/validation.js";
import User from "./models/User.js";
import Expense from "./models/Expense.js";
import Budget from "./models/Budget.js";
import Category from "./models/Category.js";

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("health endpoint reports API availability without a database connection", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("protected resources reject requests without a bearer token", async () => {
  const response = await fetch(`${baseUrl}/api/categories`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Sign in to continue." });
});

test("unknown routes return a JSON not-found response", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(response.status, 404);
  assert.match((await response.json()).message, /No route/);
});

test("expense search text is escaped before it is used as a regular expression", () => {
  const escaped = escapeRegex("meal.*[today]");
  assert.equal(new RegExp(escaped).test("meal.*[today]"), true);
  assert.equal(new RegExp(escaped).test("meal anything today"), false);
});

test("expense input rejects zero-value amounts", () => {
  const result = expenseInputSchema.safeParse({
    title: "Lunch",
    amount: 0,
    category: "507f1f77bcf86cd799439011",
    date: "2026-10-08",
    paymentMethod: "cash"
  });
  assert.equal(result.success, false);
});

test("MongoDB models define the required Retain collections and fields", () => {
  const user = new User({ name: "A Person", email: "person@example.com", passwordHash: "hash" });
  assert.equal(user.role, "user");
  assert.equal(user.validateSync(), undefined);

  const expense = new Expense({
    user: user._id,
    title: "Lunch",
    amount: 12000,
    category: new Category({ name: "Food", slug: "food" })._id,
    date: new Date("2026-10-08T12:00:00Z"),
    paymentMethod: "mobile money",
    notes: "Team lunch"
  });
  assert.equal(expense.validateSync(), undefined);

  const budget = new Budget({ user: user._id, year: 2026, month: 10, amount: 250000 });
  assert.equal(budget.validateSync(), undefined);
  assert.deepEqual(
    [User, Expense, Budget, Category].map((model) => model.collection.name),
    ["users", "expenses", "budgets", "categories"]
  );
  assert.ok(Budget.schema.indexes().some(([index, options]) =>
    index.user === 1 && index.year === 1 && index.month === 1 && options.unique
  ));
});
