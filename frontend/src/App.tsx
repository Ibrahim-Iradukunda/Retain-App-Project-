import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownLeft, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, Bell,
  CircleHelp, Clock3, CreditCard, LayoutDashboard,
  LogOut, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles,
  Tag, Trash2, TrendingUp, Wallet, X
} from "lucide-react";
import { api, currency, monthLabel, type Category, type Dashboard, type Expense, type User } from "./api";

type AuthResponse = { token: string; user: User };
type ExpenseList = { expenses: Expense[]; pagination: { page: number; limit: number; total: number; pages: number } };

const today = new Date();
const initialMonth = { year: today.getFullYear(), month: today.getMonth() + 1 };
const blankExpense = {
  title: "", amount: "", category: "", date: today.toISOString().slice(0, 10),
  paymentMethod: "card", notes: ""
};

function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("retain-user") ?? "null") as User | null;
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState<"overview" | "transactions" | "budgets" | "admin">("overview");
  const [month, setMonth] = useState(initialMonth);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [expenses, setExpenses] = useState<ExpenseList | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"expense" | "budget" | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [pageNumber, setPageNumber] = useState(1);
  const [form, setForm] = useState(blankExpense);
  const [budgetInput, setBudgetInput] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [admin, setAdmin] = useState<Record<string, unknown> | null>(null);

  const showError = (error: unknown) => {
    setNotice(error instanceof Error ? error.message : "Something went wrong. Please try again.");
  };

  const loadCategories = useCallback(async () => {
    const data = await api<{ categories: Category[] }>("/categories");
    setCategories(data.categories);
  }, []);

  const loadDashboard = useCallback(async () => {
    const query = new URLSearchParams({ year: String(month.year), month: String(month.month) });
    setDashboard(await api<Dashboard>(`/dashboard?${query}`));
  }, [month]);

  const loadExpenses = useCallback(async () => {
    const query = new URLSearchParams({
      page: String(pageNumber),
      limit: "8",
      sortBy: sort,
      order: "desc"
    });
    if (search) query.set("search", search);
    if (filterCategory) query.set("category", filterCategory);
    if (filterMethod) query.set("paymentMethod", filterMethod);
    if (filterFrom) query.set("from", new Date(`${filterFrom}T00:00:00`).toISOString());
    if (filterTo) query.set("to", new Date(`${filterTo}T23:59:59.999`).toISOString());
    if (filterMinAmount) query.set("minAmount", filterMinAmount);
    if (filterMaxAmount) query.set("maxAmount", filterMaxAmount);
    if (page === "overview") {
      query.set("from", new Date(Date.UTC(month.year, month.month - 1, 1)).toISOString());
      query.set("to", new Date(Date.UTC(month.year, month.month, 0, 23, 59, 59, 999)).toISOString());
    }
    setExpenses(await api<ExpenseList>(`/expenses?${query}`));
  }, [pageNumber, sort, search, filterCategory, filterMethod, filterFrom, filterTo, filterMinAmount, filterMaxAmount, page, month]);

  const loadPage = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setNotice("");
    try {
      await Promise.all([loadCategories(), loadDashboard(), loadExpenses()]);
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [user, loadCategories, loadDashboard, loadExpenses]);

  useEffect(() => { void loadPage(); }, [loadPage]);
  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener("retain:unauthorized", expire);
    return () => window.removeEventListener("retain:unauthorized", expire);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const timer = window.setTimeout(() => setPageNumber(1), 250);
    return () => window.clearTimeout(timer);
  }, [search, filterCategory, filterMethod, filterFrom, filterTo, filterMinAmount, filterMaxAmount, sort, month]);

  const greetingName = useMemo(() => user?.name.split(" ")[0] ?? "there", [user]);
  const changeMonth = (amount: number) => {
    const date = new Date(month.year, month.month - 1 + amount, 1);
    setMonth({ year: date.getFullYear(), month: date.getMonth() + 1 });
  };

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    try {
      const result = await api<AuthResponse>(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(authForm)
      });
      localStorage.setItem("retain-token", result.token);
      localStorage.setItem("retain-user", JSON.stringify(result.user));
      setUser(result.user);
    } catch (error) {
      showError(error);
    }
  }

  function signOut() {
    localStorage.removeItem("retain-token");
    localStorage.removeItem("retain-user");
    setUser(null);
    setDashboard(null);
    setExpenses(null);
    setPage("overview");
  }

  function openNewExpense(expense?: Expense) {
    setEditing(expense ?? null);
    setForm(expense ? {
      title: expense.title,
      amount: String(expense.amount),
      category: expense.category._id,
      date: expense.date.slice(0, 10),
      paymentMethod: expense.paymentMethod,
      notes: expense.notes ?? ""
    } : { ...blankExpense, category: categories[0]?._id ?? "" });
    setModal("expense");
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api(`/expenses${editing ? `/${editing._id}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount), date: new Date(`${form.date}T12:00:00`).toISOString() })
      });
      setModal(null);
      await loadPage();
      setNotice(editing ? "Expense updated." : "Expense added.");
    } catch (error) {
      showError(error);
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!window.confirm(`Delete “${expense.title}”? This cannot be undone.`)) return;
    try {
      await api(`/expenses/${expense._id}`, { method: "DELETE" });
      await loadPage();
      setNotice("Expense deleted.");
    } catch (error) {
      showError(error);
    }
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api("/budgets", {
        method: "PUT",
        body: JSON.stringify({ ...month, amount: Number(budgetInput) })
      });
      setModal(null);
      await loadPage();
      setNotice("Monthly budget saved.");
    } catch (error) {
      showError(error);
    }
  }

  async function loadAdmin() {
    try {
      const [result] = await Promise.all([
        api<Record<string, unknown>>("/admin/insights"),
        loadCategories()
      ]);
      setAdmin(result);
      setPage("admin");
    } catch (error) {
      showError(error);
    }
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-brand"><div className="brand-mark"><Wallet size={19} /></div><span>retain</span></div>
        <div className="auth-card">
          <div className="auth-symbol"><Sparkles size={21} /></div>
          <p className="eyebrow">A little more clarity</p>
          <h1>{authMode === "signin" ? "Welcome back." : "A fresh start."}</h1>
          <p className="auth-copy">{authMode === "signin" ? "Your money, right where you left it." : "Make space for better money habits."}</p>
          <form onSubmit={submitAuth} className="form-stack">
            {authMode === "signup" && <label>Your name<input required minLength={2} maxLength={80} autoComplete="name" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Alex Morgan" /></label>}
            <label>Email address<input required type="email" autoComplete="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
            <label>Password<input required minLength={authMode === "signup" ? 10 : 1} type="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder={authMode === "signup" ? "At least 10 characters" : "Your password"} /></label>
            <button className="button-primary auth-submit" type="submit">{authMode === "signin" ? "Sign in" : "Create account"}<ArrowRight size={16} /></button>
          </form>
          <p className="auth-switch">{authMode === "signin" ? "New to Retain?" : "Already have an account?"}<button onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setNotice(""); }}>{authMode === "signin" ? "Create an account" : "Sign in"}</button></p>
        </div>
        <span className="auth-foot">A gentler way to manage your money.</span>
        {notice && <div className="toast toast-error"><CircleHelp size={16} />{notice}</div>}
      </div>
    );
  }

  const budgetPercent = dashboard?.budget ? Math.min((dashboard.totalSpent / dashboard.budget) * 100, 100) : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Wallet size={18} /></div><span>retain</span><span className="brand-dot">.</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          <button className={`nav-item ${page === "overview" ? "active" : ""}`} onClick={() => setPage("overview")}><LayoutDashboard size={17} />Overview</button>
          <button className={`nav-item ${page === "transactions" ? "active" : ""}`} onClick={() => setPage("transactions")}><ArrowDownUp size={17} />Transactions</button>
          <button className={`nav-item ${page === "budgets" ? "active" : ""}`} onClick={() => setPage("budgets")}><CreditCard size={17} />Budgets</button>
          {user.role === "admin" && <button className={`nav-item ${page === "admin" ? "active" : ""}`} onClick={() => void loadAdmin()}><ShieldCheck size={17} />Admin insights</button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="tip-icon"><Sparkles size={15} /></div><strong>Small steps add up.</strong><p>Understanding your spending is the first step to feeling in control.</p></div>
          <div className="profile">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div className="profile-info"><strong>{user.name}</strong><span>{user.role === "admin" ? "Administrator" : "Personal account"}</span></div>
            <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">My workspace <span>/</span> <strong>{page === "overview" ? "Overview" : page === "transactions" ? "Transactions" : page === "budgets" ? "Budgets" : "Admin insights"}</strong></div>
          <div className="top-actions"><span className="today-label"><span className="online-dot" /> All data up to date</span><button className="top-icon" aria-label="Notifications"><Bell size={17} /><i /></button><div className="avatar avatar-small">{user.name.slice(0, 1).toUpperCase()}</div></div>
        </header>
        <div className="content">
          {page === "admin" ? (
            <AdminPage data={admin} categories={categories} onRefresh={loadAdmin} onError={showError} />
          ) : page === "budgets" ? (
            <BudgetsPage dashboard={dashboard} month={month} changeMonth={changeMonth} onEdit={() => { setBudgetInput(String(dashboard?.budget || "")); setModal("budget"); }} onAdd={() => openNewExpense()} />
          ) : (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">{page === "overview" ? "YOUR MONEY, IN VIEW" : "YOUR MONEY, ORGANIZED"}</p><h1>{page === "overview" ? <>Good {greetingName}, <span className="heading-light">here’s your month.</span></> : "Every little detail."}</h1><p className="heading-sub">{page === "overview" ? "A clear picture of where your money is going." : "Search and sort your spending, one line at a time."}</p></div>
                <div className="heading-actions">
                  <div className="month-picker"><button aria-label="Previous month" onClick={() => changeMonth(-1)}><ArrowLeft size={15} /></button><span>{monthLabel(month.year, month.month)}</span><button aria-label="Next month" onClick={() => changeMonth(1)}><ArrowRight size={15} /></button></div>
                  <button className="button-primary" onClick={() => openNewExpense()}><Plus size={16} />Add expense</button>
                </div>
              </div>
              {page === "overview" && <OverviewCards dashboard={dashboard} budgetPercent={budgetPercent} onBudget={() => { setBudgetInput(String(dashboard?.budget || "")); setModal("budget"); }} />}
              <section className="section-block">
                <div className="section-heading"><div><h2>{page === "overview" ? "Recent transactions" : "All transactions"} <span className="count-pill">{expenses?.pagination.total ?? 0}</span></h2><p>{page === "overview" ? "The latest activity in your account." : "Your personal spending history."}</p></div><div className="table-actions"><div className="search-box"><Search size={15} /><input aria-label="Search expenses" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} /></div>{page === "transactions" && <button className="filter-button" onClick={() => setFilterCategory(filterCategory ? "" : categories[0]?._id ?? "")}><SlidersHorizontal size={15} />Filter</button>}{page === "overview" && <button className="text-link" onClick={() => setPage("transactions")}>View all <ArrowRight size={14} /></button>}</div></div>
                {page === "transactions" && <div className="filters-row">
                  <label><Tag size={14} /><select aria-label="Filter by category" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}><option value="">All categories</option>{categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}</select></label>
                  <label><CreditCard size={14} /><select aria-label="Filter by payment method" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}><option value="">All payment methods</option>{["cash", "card", "bank transfer", "mobile money", "other"].map(method => <option key={method} value={method}>{method}</option>)}</select></label>
                  <label><ArrowDownUp size={14} /><select aria-label="Sort expenses" value={sort} onChange={e => setSort(e.target.value as "date" | "amount")}><option value="date">Sort by date</option><option value="amount">Sort by amount</option></select></label>
                  <label className="filter-input"><span>From</span><input aria-label="From date" type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} /></label>
                  <label className="filter-input"><span>To</span><input aria-label="To date" type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} /></label>
                  <label className="filter-input"><span>Min RWF</span><input aria-label="Minimum amount" type="number" min="0" value={filterMinAmount} onChange={e => setFilterMinAmount(e.target.value)} /></label>
                  <label className="filter-input"><span>Max RWF</span><input aria-label="Maximum amount" type="number" min="0" value={filterMaxAmount} onChange={e => setFilterMaxAmount(e.target.value)} /></label>
                </div>}
                <Transactions expenses={expenses?.expenses ?? []} loading={loading} onEdit={openNewExpense} onDelete={deleteExpense} />
                {expenses && expenses.pagination.pages > 1 && <div className="pagination"><span>Showing {(pageNumber - 1) * expenses.pagination.limit + 1}–{Math.min(pageNumber * expenses.pagination.limit, expenses.pagination.total)} of {expenses.pagination.total}</span><div><button disabled={pageNumber <= 1} onClick={() => setPageNumber(pageNumber - 1)} aria-label="Previous page"><ArrowLeft size={15} /></button><span className="page-current">{pageNumber}</span><button disabled={pageNumber >= expenses.pagination.pages} onClick={() => setPageNumber(pageNumber + 1)} aria-label="Next page"><ArrowRight size={15} /></button></div></div>}
              </section>
              {page === "overview" && <CategorySection categories={dashboard?.byCategory ?? []} total={dashboard?.totalSpent ?? 0} month={month} />}
              <footer className="footer"><span>Made for a little more peace of mind.</span><span>RWF <span className="footer-dot">·</span> Personal finances <span className="footer-dot">·</span> <CircleHelp size={13} /> Help center</span></footer>
            </>
          )}
        </div>
      </main>
      {notice && <div className={`toast ${notice.includes("unexpected") || notice.includes("invalid") || notice.includes("required") ? "toast-error" : ""}`}><span className="toast-check">✓</span>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}
      {modal === "expense" && <Modal title={editing ? "Edit expense" : "Add an expense"} onClose={() => setModal(null)}><form className="form-stack expense-form" onSubmit={saveExpense}>
        <label>What was it for?<input required maxLength={120} placeholder="e.g. Lunch with friends" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <div className="form-grid"><label>Amount (RWF)<input type="number" required min="1" step="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="12,500" /></label><label>Category<select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="">Choose a category</option>{categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}</select></label></div>
        <div className="form-grid"><label>Date<input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><label>Payment method<select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>{["cash", "card", "bank transfer", "mobile money", "other"].map(method => <option key={method} value={method}>{method}</option>)}</select></label></div>
        <label>Notes <span className="optional">(optional)</span><textarea maxLength={500} rows={3} placeholder="Add a note..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
        <div className="modal-actions"><button type="button" className="button-quiet" onClick={() => setModal(null)}>Cancel</button><button className="button-primary" type="submit">{editing ? "Save changes" : "Add expense"}<ArrowRight size={15} /></button></div>
      </form></Modal>}
      {modal === "budget" && <Modal title={`Your ${monthLabel(month.year, month.month)} budget`} onClose={() => setModal(null)}><form className="form-stack" onSubmit={saveBudget}><p className="modal-copy">Choose a monthly spending amount that feels right for you. You can change it any time.</p><label>Monthly budget (RWF)<input type="number" required min="1" step="1" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="e.g. 500,000" /></label><div className="modal-actions"><button className="button-quiet" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button-primary" type="submit">Save budget<ArrowRight size={15} /></button></div></form></Modal>}
    </div>
  );
}

function OverviewCards({ dashboard, budgetPercent, onBudget }: { dashboard: Dashboard | null; budgetPercent: number; onBudget: () => void }) {
  const status = dashboard?.budgetStatus ?? "not-set";
  const statusText = status === "within" ? "Looking good" : status === "approaching" ? "Getting close" : status === "over" ? "Over budget" : "No budget set";
  return <div className="overview-grid">
    <article className="summary-card spending-card"><div className="card-top"><span className="card-label">Total spent</span><span className="soft-icon green-soft"><ArrowUpRight size={17} /></span></div><strong className="big-number">{currency(dashboard?.totalSpent ?? 0)}</strong><div className="card-bottom"><span className="subtle-text">Across {dashboard?.expenseCount ?? 0} {dashboard?.expenseCount === 1 ? "transaction" : "transactions"}</span><span className="period-chip"><Clock3 size={12} /> This month</span></div></article>
    <article className="summary-card budget-card"><div className="card-top"><span className="card-label">Budget left</span><span className={`status-pill status-${status}`}>{statusText}</span></div><strong className="big-number">{dashboard?.budget ? currency(dashboard.remaining) : <span className="unset-budget">Let’s set one</span>}</strong><div className="progress-track"><span className={`progress-fill ${status}`} style={{ width: `${budgetPercent}%` }} /></div><div className="card-bottom"><span className="subtle-text">{dashboard?.budget ? `${Math.round(budgetPercent)}% of ${currency(dashboard.budget)} used` : "A little planning goes a long way"}</span><button className="mini-link" onClick={onBudget}>{dashboard?.budget ? "Edit budget" : "Set budget"}<ArrowRight size={12} /></button></div></article>
    <article className="summary-card highlight-card"><div className="card-top"><span className="card-label">Your biggest spend</span><span className="soft-icon peach-soft"><TrendingUp size={17} /></span></div><strong className="big-number">{currency(dashboard?.highestExpense ?? 0)}</strong><div className="card-bottom"><span className="subtle-text">Your highest single expense</span><span className="insight-label"><Sparkles size={12} /> This month</span></div></article>
  </div>;
}

function Transactions({ expenses, loading, onEdit, onDelete }: { expenses: Expense[]; loading: boolean; onEdit: (expense: Expense) => void; onDelete: (expense: Expense) => void }) {
  if (loading && expenses.length === 0) return <div className="empty-state"><div className="empty-icon"><Clock3 size={21} /></div><strong>Gathering your details…</strong><p>Your spending snapshot will be ready in just a moment.</p></div>;
  if (expenses.length === 0) return <div className="empty-state"><div className="empty-icon"><ArrowDownLeft size={21} /></div><strong>No expenses just yet</strong><p>Your spending will show up here once you add your first expense.</p></div>;
  return <div className="table-wrap"><table><thead><tr><th>DESCRIPTION</th><th>CATEGORY</th><th>DATE</th><th>PAYMENT</th><th className="amount-col">AMOUNT</th><th aria-label="Actions"></th></tr></thead><tbody>{expenses.map(expense => <tr key={expense._id}>
    <td><div className="expense-title-cell"><span className="expense-category-icon" style={{ background: `${expense.category?.color ?? "#6b8f71"}18`, color: expense.category?.color ?? "#6b8f71" }}><Tag size={15} /></span><div><strong>{expense.title}</strong>{expense.notes && <span className="expense-note">{expense.notes}</span>}</div></div></td>
    <td><span className="category-tag"><i style={{ background: expense.category?.color ?? "#6b8f71" }} />{expense.category?.name ?? "Uncategorized"}</span></td>
    <td className="date-cell">{new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(expense.date))}</td>
    <td><span className="payment-tag"><CreditCard size={13} />{expense.paymentMethod}</span></td>
    <td className="amount-col"><strong className="amount-value">− {currency(expense.amount)}</strong></td>
    <td><div className="row-actions"><button aria-label={`Edit ${expense.title}`} title="Edit expense" onClick={() => onEdit(expense)}><Settings2 size={15} /></button><button aria-label={`Delete ${expense.title}`} title="Delete expense" onClick={() => onDelete(expense)}><Trash2 size={15} /></button></div></td>
  </tr>)}</tbody></table></div>;
}

function CategorySection({ categories, total, month }: { categories: Dashboard["byCategory"]; total: number; month: { year: number; month: number } }) {
  return <section className="section-block category-overview"><div className="section-heading"><div><h2>Where it goes</h2><p>A little breakdown of your spending.</p></div><span className="section-month">{monthLabel(month.year, month.month)}</span></div><div className="category-grid">{categories.length === 0 ? <p className="category-empty">Your categories will appear here as you add expenses.</p> : categories.slice(0, 4).map(item => <div className="category-card" key={item.category}><div className="category-card-top"><div className="category-card-title"><i style={{ background: item.color }} />{item.category}</div><span>{item.count} {item.count === 1 ? "expense" : "expenses"}</span></div><strong>{currency(item.total)}</strong><div className="mini-track"><span style={{ background: item.color, width: `${total ? (item.total / total) * 100 : 0}%` }} /></div></div>)}</div></section>;
}

function BudgetsPage({ dashboard, month, changeMonth, onEdit, onAdd }: { dashboard: Dashboard | null; month: { year: number; month: number }; changeMonth: (amount: number) => void; onEdit: () => void; onAdd: () => void }) {
  const percent = dashboard?.budget ? Math.min((dashboard.totalSpent / dashboard.budget) * 100, 100) : 0;
  const status = dashboard?.budgetStatus ?? "not-set";
  return <><div className="page-heading"><div><p className="eyebrow">YOUR MONTH, YOUR PACE</p><h1>A plan that feels <span className="heading-light">like yours.</span></h1><p className="heading-sub">A little intention can make the month feel lighter.</p></div><div className="heading-actions"><div className="month-picker"><button aria-label="Previous month" onClick={() => changeMonth(-1)}><ArrowLeft size={15} /></button><span>{monthLabel(month.year, month.month)}</span><button aria-label="Next month" onClick={() => changeMonth(1)}><ArrowRight size={15} /></button></div><button className="button-primary" onClick={onEdit}><Settings2 size={15} />{dashboard?.budget ? "Edit budget" : "Set a budget"}</button></div></div>
    <div className="budget-layout"><section className="budget-main-card"><div className="budget-card-head"><div><p className="eyebrow">MONTHLY OVERVIEW</p><h2>{monthLabel(month.year, month.month)}</h2></div><span className={`status-pill status-${status}`}>{status === "not-set" ? "No budget yet" : status === "over" ? "Over budget" : status === "approaching" ? "Getting close" : "On track"}</span></div><div className="budget-total-row"><div><span className="card-label">Your monthly allowance</span><strong>{dashboard?.budget ? currency(dashboard.budget) : "—"}</strong></div><div><span className="card-label">Already spent</span><strong>{currency(dashboard?.totalSpent ?? 0)}</strong></div></div><div className="budget-progress"><div className="budget-progress-caption"><span>Spending progress</span><strong>{Math.round(percent)}%</strong></div><div className="progress-track"><span className={`progress-fill ${status}`} style={{ width: `${percent}%` }} /></div></div><div className="budget-balance"><div className={`balance-icon ${status === "over" ? "over" : ""}`}>{status === "over" ? <ArrowUpRight size={19} /> : <ArrowDownLeft size={19} />}</div><div><span>{status === "over" ? "Amount over budget" : "Still yours to spend"}</span><strong>{dashboard?.budget ? currency(Math.abs(dashboard.remaining)) : "Set a budget to get started"}</strong></div><button className="button-quiet" onClick={onAdd}><Plus size={15} />Add an expense</button></div></section><aside className="budget-aside"><div className="budget-note"><div className="tip-icon"><Sparkles size={16} /></div><p className="eyebrow">A NOTE FOR YOU</p><h3>{status === "over" ? "Tomorrow is a new page." : status === "approaching" ? "You’re paying attention." : "Progress, not perfection."}</h3><p>{status === "over" ? "Your budget is a guide, not a grade. Take a breath and check in again when you’re ready." : "A small check-in with your spending is already a meaningful step. You’re doing great."}</p></div><div className="budget-fact"><span className="soft-icon green-soft"><TrendingUp size={16} /></span><div><span>Highest expense this month</span><strong>{currency(dashboard?.highestExpense ?? 0)}</strong></div></div><div className="budget-fact"><span className="soft-icon peach-soft"><Tag size={16} /></span><div><span>Number of transactions</span><strong>{dashboard?.expenseCount ?? 0}</strong></div></div></aside></div>
    <section className="section-block budget-categories"><div className="section-heading"><div><h2>Your spending by category</h2><p>See what’s making up your month.</p></div></div><CategorySection categories={dashboard?.byCategory ?? []} total={dashboard?.totalSpent ?? 0} month={month} /></section></>;
}

function AdminPage({ data, categories, onRefresh, onError }: { data: Record<string, unknown> | null; categories: Category[]; onRefresh: () => Promise<void>; onError: (error: unknown) => void }) {
  if (!data) return <div className="empty-state"><strong>Loading platform insights…</strong></div>;
  const categoryStats = data.categoryStats as Dashboard["byCategory"] | undefined;
  const recentUsers = data.recentUsers as { _id: string; name: string; email: string }[] | undefined;
  const recentExpenses = data.recentExpenses as { _id: string; title: string; amount: number; user?: { name: string }; category?: { name: string }; createdAt: string }[] | undefined;
  return <><div className="page-heading"><div><p className="eyebrow">PLATFORM OVERVIEW</p><h1>Good morning, <span className="heading-light">admin.</span></h1><p className="heading-sub">A thoughtful overview of what’s happening across Retain.</p></div></div><div className="overview-grid admin-stats"><article className="summary-card"><div className="card-top"><span className="card-label">Registered users</span><span className="soft-icon green-soft"><ShieldCheck size={17} /></span></div><strong className="big-number">{String(data.registeredUsers ?? 0)}</strong><div className="card-bottom"><span className="subtle-text">Across the platform</span></div></article><article className="summary-card"><div className="card-top"><span className="card-label">Total expenses</span><span className="soft-icon peach-soft"><CreditCard size={17} /></span></div><strong className="big-number">{String(data.expenseCount ?? 0)}</strong><div className="card-bottom"><span className="subtle-text">All user accounts</span></div></article><article className="summary-card"><div className="card-top"><span className="card-label">Total spending recorded</span><span className="soft-icon green-soft"><TrendingUp size={17} /></span></div><strong className="big-number">{currency(Number(data.totalSpending ?? 0))}</strong><div className="card-bottom"><span className="subtle-text">Across all transactions</span></div></article></div><section className="section-block"><div className="section-heading"><div><h2>Most-used categories</h2><p>Platform-wide spending by category.</p></div></div><div className="category-grid">{categoryStats?.map(category => <div className="category-card" key={category.category}><div className="category-card-title"><i style={{ background: category.color }} />{category.category}</div><strong>{currency(category.total)}</strong><span>{category.count} expenses</span></div>)}</div></section><section className="section-block"><div className="section-heading"><div><h2>Expense categories</h2><p>Keep the options useful and easy to browse.</p></div></div><CategoryManagement categories={categories} onRefresh={onRefresh} onError={onError} /></section><section className="section-block"><div className="section-heading"><div><h2>Recently joined</h2><p>The latest people to make Retain their own.</p></div></div><div className="table-wrap"><table><thead><tr><th>NAME</th><th>EMAIL</th></tr></thead><tbody>{recentUsers?.map(person => <tr key={person._id}><td><strong>{person.name}</strong></td><td className="date-cell">{person.email}</td></tr>)}</tbody></table></div></section><section className="section-block"><div className="section-heading"><div><h2>Recently added expenses</h2><p>Latest activity across all accounts.</p></div></div><div className="table-wrap"><table><thead><tr><th>DESCRIPTION</th><th>USER</th><th>CATEGORY</th><th>ADDED</th><th className="amount-col">AMOUNT</th></tr></thead><tbody>{recentExpenses?.map(expense => <tr key={expense._id}><td><strong>{expense.title}</strong></td><td>{expense.user?.name ?? "Unknown user"}</td><td>{expense.category?.name ?? "Uncategorized"}</td><td className="date-cell">{new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(expense.createdAt))}</td><td className="amount-col"><strong className="amount-value">{currency(expense.amount)}</strong></td></tr>)}</tbody></table></div></section></>;
}

function CategoryManagement({ categories, onRefresh, onError }: { categories: Category[]; onRefresh: () => Promise<void>; onError: (error: unknown) => void }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6b8f71");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6b8f71");

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api("/categories", { method: "POST", body: JSON.stringify({ name: newName, color: newColor }) });
      setNewName("");
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function updateCategory(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    try {
      await api(`/categories/${id}`, { method: "PATCH", body: JSON.stringify({ name: editName, color: editColor }) });
      setEditingId("");
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete the “${category.name}” category?`)) return;
    try {
      await api(`/categories/${category._id}`, { method: "DELETE" });
      await onRefresh();
    } catch (error) {
      onError(error);
    }
  }

  return <div className="category-manager">
    <form className="category-create" onSubmit={createCategory}>
      <label>New category<input required minLength={2} maxLength={40} value={newName} onChange={event => setNewName(event.target.value)} placeholder="e.g. Education" /></label>
      <label>Color<input aria-label="New category color" type="color" value={newColor} onChange={event => setNewColor(event.target.value)} /></label>
      <button className="button-primary" type="submit"><Plus size={15} />Add category</button>
    </form>
    <div className="category-manage-list">{categories.map(category => editingId === category._id
      ? <form className="category-manage-row" key={category._id} onSubmit={event => void updateCategory(event, category._id)}>
        <label className="category-edit-name"><span>Name</span><input required minLength={2} maxLength={40} value={editName} onChange={event => setEditName(event.target.value)} /></label>
        <label><span>Color</span><input aria-label={`Color for ${category.name}`} type="color" value={editColor} onChange={event => setEditColor(event.target.value)} /></label>
        <button className="button-primary" type="submit">Save</button><button className="button-quiet" type="button" onClick={() => setEditingId("")}>Cancel</button>
      </form>
      : <div className="category-manage-row" key={category._id}>
        <div className="category-card-title"><i style={{ background: category.color }} />{category.name}</div>
        <span className="category-slug">{category.slug}</span>
        <button className="button-quiet" type="button" onClick={() => { setEditingId(category._id); setEditName(category.name); setEditColor(category.color); }}>Edit</button>
        <button className="button-quiet category-delete" type="button" onClick={() => void deleteCategory(category)}>Delete</button>
      </div>)}</div>
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><p className="eyebrow">A LITTLE MORE CLARITY</p><h2 id="modal-title">{title}</h2></div><button className="icon-button modal-close" aria-label="Close" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}

export default App;
