import { useState, useEffect, useMemo } from 'react';
import { accountsApi, categoriesApi, budgetsApi } from '../api';
import { Modal, DataTable, Badge, PageHeader, LoadingSpinner } from '../components/Common';
import { FaPlus, FaTrash, FaKey, FaCaretRight, FaCaretDown } from 'react-icons/fa';
import toast from 'react-hot-toast';

/**
 * Flatten the server-returned category tree into a list of rows, each annotated
 * with `depth` and `path` so we can render hierarchical categories with
 * indentation in the existing DataTable, and offer them as parent_id options.
 */
function flattenTree(tree, depth = 0, path = []) {
  const out = [];
  for (const node of tree) {
    const myPath = [...path, node.name];
    out.push({ ...node, depth, path: myPath });
    if (node.children && node.children.length > 0) {
      out.push(...flattenTree(node.children, depth + 1, myPath));
    }
  }
  return out;
}

export default function Settings() {
  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  // Form state
  const [accountForm, setAccountForm] = useState({ name: '', type: 'checking', currency: 'USD', opening_balance: 0 });
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense', color: '#3b82f6', icon: '', parent_id: '' });
  const [budgetForm, setBudgetForm] = useState({ category_id: '', amount: '', period: 'monthly', start_date: new Date().toISOString().split('T')[0] });
  const [apiKey, setApiKey] = useState('');

  const flatCategories = useMemo(() => flattenTree(categoryTree), [categoryTree]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accRes, catRes, budRes] = await Promise.all([
        accountsApi.list(),
        categoriesApi.list(),
        budgetsApi.list(),
      ]);
      setAccounts(accRes.data || []);
      setCategoryTree(catRes.data || []);
      setBudgets(budRes.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    try {
      await accountsApi.create(accountForm);
      toast.success('Account created');
      setShowAccountModal(false);
      setAccountForm({ name: '', type: 'checking', currency: 'USD', opening_balance: 0 });
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleArchiveAccount = async (id) => {
    if (!confirm('Archive this account?')) return;
    try {
      await accountsApi.archive(id);
      toast.success('Account archived');
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleAddCategory = async () => {
    try {
      const payload = { ...categoryForm };
      if (!payload.parent_id) delete payload.parent_id;
      if (!payload.icon) delete payload.icon;
      await categoriesApi.create(payload);
      toast.success('Category created');
      setShowCategoryModal(false);
      setCategoryForm({ name: '', type: 'expense', color: '#3b82f6', icon: '', parent_id: '' });
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Delete this category? Sub-categories will be detached.')) return;
    try {
      await categoriesApi.delete(id);
      toast.success('Category deleted');
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleAddBudget = async () => {
    try {
      await budgetsApi.create({ ...budgetForm, amount: parseFloat(budgetForm.amount) });
      toast.success('Budget created');
      setShowBudgetModal(false);
      setBudgetForm({ category_id: '', amount: '', period: 'monthly', start_date: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteBudget = async (id) => {
    if (!confirm('Delete this budget?')) return;
    try {
      await budgetsApi.delete(id);
      toast.success('Budget deleted');
      loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleSaveApiKey = () => {
    toast.success('API key saved (set ZAI_API_KEY in backend .env and restart)');
  };

  const tabs = ['accounts', 'categories', 'budgets', 'api'];

  // Parent options that are NOT descendants of self (prevent self-cycles when editing).
  const parentOptions = useMemo(
    () => flatCategories.filter(c => c.type === categoryForm.type),
    [flatCategories, categoryForm.type]
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="flex gap-2 mb-6" role="tablist">
        {tabs.map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`btn-secondary capitalize ${tab === t ? 'bg-accent text-white' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'api' ? 'API Key' : t}
          </button>
        ))}
      </div>

      {/* Accounts Tab */}
      {tab === 'accounts' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowAccountModal(true)} aria-label="Add account">
              <FaPlus aria-hidden="true" /> Add Account
            </button>
          </div>
          <div className="card">
            <DataTable
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type', render: (v) => <Badge color="blue">{v}</Badge> },
                { key: 'currency', label: 'Currency' },
                {
                  key: 'current_balance', label: 'Balance',
                  render: (v) => <span className="font-medium">${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>,
                },
                {
                  key: 'actions', label: '',
                  render: (_, row) => (
                    <button
                      onClick={() => handleArchiveAccount(row.id)}
                      className="text-muted hover:text-expense text-sm flex items-center gap-1"
                      aria-label={`Archive account ${row.name}`}
                    >
                      <FaTrash aria-hidden="true" /> Archive
                    </button>
                  ),
                },
              ]}
              data={accounts}
            />
          </div>
        </div>
      )}

      {/* Categories Tab — hierarchical */}
      {tab === 'categories' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowCategoryModal(true)} aria-label="Add category">
              <FaPlus aria-hidden="true" /> Add Category
            </button>
          </div>
          <div className="card">
            <DataTable
              columns={[
                {
                  key: 'name', label: 'Name',
                  render: (v, row) => (
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${(row.depth || 0) * 20}px` }}
                    >
                      {row.children && row.children.length > 0
                        ? <FaCaretDown className="text-muted" aria-hidden="true" />
                        : (row.depth || 0) > 0
                          ? <FaCaretRight className="text-muted opacity-40" aria-hidden="true" />
                          : <span className="w-3" />}
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.color }} />
                      <span>{v}</span>
                      {row.is_system && <Badge color="gray">system</Badge>}
                    </div>
                  ),
                },
                { key: 'type', label: 'Type', render: (v) => <Badge color={v === 'income' ? 'green' : 'red'}>{v}</Badge> },
                {
                  key: 'parent_name', label: 'Parent',
                  render: (v) => v ? <span className="text-sm text-muted">{v}</span> : <span className="text-xs text-muted">—</span>,
                },
                {
                  key: 'actions', label: '',
                  render: (_, row) => !row.is_system ? (
                    <button
                      onClick={() => handleDeleteCategory(row.id)}
                      className="text-muted hover:text-expense text-sm flex items-center gap-1"
                      aria-label={`Delete category ${row.name}`}
                    >
                      <FaTrash aria-hidden="true" /> Delete
                    </button>
                  ) : <span className="text-xs text-muted">System default</span>,
                },
              ]}
              data={flatCategories}
            />
          </div>
        </div>
      )}

      {/* Budgets Tab */}
      {tab === 'budgets' && (
        <div>
          <div className="flex justify-end mb-4">
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowBudgetModal(true)} aria-label="Add budget">
              <FaPlus aria-hidden="true" /> Add Budget
            </button>
          </div>
          <div className="card">
            <DataTable
              columns={[
                {
                  key: 'category_name', label: 'Category',
                  render: (v, row) => (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.category_color }} />
                      <span>{v}</span>
                    </div>
                  ),
                },
                {
                  key: 'amount', label: 'Budget Amount',
                  render: (v) => <span className="font-medium">${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>,
                },
                { key: 'period', label: 'Period', render: (v) => <Badge color="blue">{v}</Badge> },
                { key: 'start_date', label: 'Start' },
                {
                  key: 'actions', label: '',
                  render: (_, row) => (
                    <button
                      onClick={() => handleDeleteBudget(row.id)}
                      className="text-muted hover:text-expense text-sm flex items-center gap-1"
                      aria-label="Delete budget"
                    >
                      <FaTrash aria-hidden="true" /> Delete
                    </button>
                  ),
                },
              ]}
              data={budgets}
            />
          </div>
        </div>
      )}

      {/* API Key Tab */}
      {tab === 'api' && (
        <div className="card max-w-lg">
          <div className="flex items-center gap-2 mb-4">
            <FaKey className="text-accent" aria-hidden="true" />
            <h3 className="font-medium">Vision API Key (Z.ai GLM-5V)</h3>
          </div>
          <p className="text-sm text-muted mb-3">
            Required for receipt scanning. Set <code>ZAI_API_KEY</code> in the backend <code>.env</code> file and restart.
            Anthropic Claude Sonnet is also supported as a fallback (<code>ANTHROPIC_API_KEY</code>).
          </p>
          <label htmlFor="api-key-input" className="sr-only">API key</label>
          <input
            id="api-key-input"
            type="password"
            className="input mb-3"
            placeholder="zai-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button className="btn-primary" onClick={handleSaveApiKey}>Save API Key</button>
        </div>
      )}

      {/* Account Modal */}
      <Modal open={showAccountModal} onClose={() => setShowAccountModal(false)} title="Add Account">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="acct-name">Account Name</label>
            <input id="acct-name" className="input" placeholder="e.g., Main Checking" value={accountForm.name} onChange={(e) => setAccountForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="acct-type">Type</label>
            <select id="acct-type" className="input" value={accountForm.type} onChange={(e) => setAccountForm(f => ({ ...f, type: e.target.value }))}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="investment">Investment</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="acct-currency">Currency</label>
              <select id="acct-currency" className="input" value={accountForm.currency} onChange={(e) => setAccountForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="acct-open">Opening Balance</label>
              <input id="acct-open" type="number" step="0.01" className="input" value={accountForm.opening_balance} onChange={(e) => setAccountForm(f => ({ ...f, opening_balance: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setShowAccountModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleAddAccount}>Create Account</button>
          </div>
        </div>
      </Modal>

      {/* Category Modal (hierarchical) */}
      <Modal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Add Category">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="cat-name">Name</label>
            <input id="cat-name" className="input" placeholder="e.g., Hobbies" value={categoryForm.name} onChange={(e) => setCategoryForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="cat-type">Type</label>
            <select id="cat-type" className="input" value={categoryForm.type} onChange={(e) => setCategoryForm(f => ({ ...f, type: e.target.value, parent_id: '' }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cat-parent">Parent category (optional)</label>
            <select id="cat-parent" className="input" value={categoryForm.parent_id} onChange={(e) => setCategoryForm(f => ({ ...f, parent_id: e.target.value }))}>
              <option value="">— Top-level —</option>
              {parentOptions.map(c => (
                <option key={c.id} value={c.id}>
                  {'  '.repeat(c.depth)}{c.depth > 0 ? '└ ' : ''}{c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted mt-1">Sub-categories inherit colour but not budgets.</p>
          </div>
          <div>
            <label className="label" htmlFor="cat-color">Color</label>
            <input id="cat-color" type="color" className="w-12 h-10 rounded border border-default bg-transparent cursor-pointer" value={categoryForm.color} onChange={(e) => setCategoryForm(f => ({ ...f, color: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setShowCategoryModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleAddCategory} disabled={!categoryForm.name.trim()}>Create Category</button>
          </div>
        </div>
      </Modal>

      {/* Budget Modal */}
      <Modal open={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Add Budget">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="bud-cat">Category</label>
            <select id="bud-cat" className="input" value={budgetForm.category_id} onChange={(e) => setBudgetForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">Select category</option>
              {flatCategories.filter(c => c.type === 'expense').map(c => (
                <option key={c.id} value={c.id}>
                  {'  '.repeat(c.depth)}{c.depth > 0 ? '└ ' : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="bud-amount">Amount</label>
              <input id="bud-amount" type="number" step="0.01" className="input" placeholder="500.00" value={budgetForm.amount} onChange={(e) => setBudgetForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="bud-period">Period</label>
              <select id="bud-period" className="input" value={budgetForm.period} onChange={(e) => setBudgetForm(f => ({ ...f, period: e.target.value }))}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="bud-start">Start Date</label>
            <input id="bud-start" type="date" className="input" value={budgetForm.start_date} onChange={(e) => setBudgetForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setShowBudgetModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleAddBudget} disabled={!budgetForm.category_id || !budgetForm.amount}>Create Budget</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
