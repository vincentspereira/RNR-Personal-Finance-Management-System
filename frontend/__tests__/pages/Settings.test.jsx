import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Settings from '../../src/pages/Settings';

vi.mock('../../src/api', () => ({
  accountsApi: {
    list: vi.fn(),
    create: vi.fn(),
    archive: vi.fn(),
  },
  categoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  budgetsApi: {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { accountsApi, categoriesApi, budgetsApi } from '../../src/api';

const mockSettingsData = () => {
  accountsApi.list.mockResolvedValue({
    data: [
      { id: 'acc-1', name: 'Checking', type: 'checking', currency: 'USD', current_balance: 5000 },
    ],
  });
  categoriesApi.list.mockResolvedValue({
    data: [
      { id: 'cat-1', name: 'Groceries', type: 'expense', color: '#3b82f6', is_system: false, children: [] },
      { id: 'cat-2', name: 'Income', type: 'income', color: '#22c55e', is_system: true, children: [] },
    ],
  });
  budgetsApi.list.mockResolvedValue({
    data: [
      { id: 'b1', category_name: 'Groceries', category_color: '#3b82f6', amount: 500, period: 'monthly', start_date: '2026-01-01' },
    ],
  });
};

const renderSettings = () =>
  render(
    <BrowserRouter>
      <Settings />
    </BrowserRouter>
  );

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  it('renders loading spinner initially', () => {
    mockSettingsData();
    renderSettings();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders Settings header and tabs', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    expect(screen.getByText('accounts')).toBeInTheDocument();
    expect(screen.getByText('categories')).toBeInTheDocument();
    expect(screen.getByText('budgets')).toBeInTheDocument();
    expect(screen.getByText('API Key')).toBeInTheDocument();
  });

  it('shows accounts tab by default with account data', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('Checking')).toBeInTheDocument());
    expect(screen.getByText('Add Account')).toBeInTheDocument();
  });

  it('archives an account', async () => {
    mockSettingsData();
    accountsApi.archive.mockResolvedValue({ data: null });
    renderSettings();
    await waitFor(() => expect(screen.getByText('Archive')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Archive'));
    await waitFor(() => expect(accountsApi.archive).toHaveBeenCalledWith('acc-1'));
  });

  it('cancels archive when confirm is false', async () => {
    window.confirm = vi.fn(() => false);
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('Archive')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Archive'));
    expect(accountsApi.archive).not.toHaveBeenCalled();
  });

  it('handles archive error', async () => {
    mockSettingsData();
    accountsApi.archive.mockRejectedValue(new Error('Archive failed'));
    renderSettings();
    await waitFor(() => expect(screen.getByText('Archive')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Archive'));
    await waitFor(() => expect(accountsApi.archive).toHaveBeenCalled());
    const toast = await import('react-hot-toast');
    expect(toast.default.error).toHaveBeenCalledWith('Archive failed');
  });

  it('switches to categories tab', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => expect(screen.getByText('Add Category')).toBeInTheDocument());
  });

  it('shows category names with colors', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Income')).toBeInTheDocument();
    });
  });

  it('shows system badge for system categories', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => expect(screen.getByText('system')).toBeInTheDocument());
  });

  it('shows system default text for system categories', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => expect(screen.getByText('System default')).toBeInTheDocument());
  });

  it('deletes a non-system category', async () => {
    mockSettingsData();
    categoriesApi.delete.mockResolvedValue({ data: null });
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      return expect(deleteButtons.length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(categoriesApi.delete).toHaveBeenCalled());
  });

  it('cancels delete category when confirm is false', async () => {
    window.confirm = vi.fn(() => false);
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      return expect(deleteButtons.length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(categoriesApi.delete).not.toHaveBeenCalled();
  });

  it('handles category delete error', async () => {
    mockSettingsData();
    categoriesApi.delete.mockRejectedValue(new Error('Delete failed'));
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      return expect(deleteButtons.length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(categoriesApi.delete).toHaveBeenCalled());
    const toast = await import('react-hot-toast');
    expect(toast.default.error).toHaveBeenCalledWith('Delete failed');
  });

  it('switches to budgets tab', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('budgets')).toBeInTheDocument());
    fireEvent.click(screen.getByText('budgets'));
    await waitFor(() => expect(screen.getByText('Add Budget')).toBeInTheDocument());
  });

  it('shows budget data in budgets tab', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('budgets')).toBeInTheDocument());
    fireEvent.click(screen.getByText('budgets'));
    await waitFor(() => expect(screen.getByText('Groceries')).toBeInTheDocument());
  });

  it('deletes a budget', async () => {
    mockSettingsData();
    budgetsApi.delete.mockResolvedValue({ data: null });
    renderSettings();
    await waitFor(() => expect(screen.getByText('budgets')).toBeInTheDocument());
    fireEvent.click(screen.getByText('budgets'));
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      return expect(deleteButtons.length).toBeGreaterThan(0);
    });
    // In budgets tab, find delete buttons
    const budgetDeleteButtons = screen.getAllByText('Delete');
    fireEvent.click(budgetDeleteButtons[0]);
    await waitFor(() => expect(budgetsApi.delete).toHaveBeenCalled());
  });

  it('cancels delete budget when confirm is false', async () => {
    window.confirm = vi.fn(() => false);
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('budgets')).toBeInTheDocument());
    fireEvent.click(screen.getByText('budgets'));
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      return expect(deleteButtons.length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(budgetsApi.delete).not.toHaveBeenCalled();
  });

  it('handles budget delete error', async () => {
    mockSettingsData();
    budgetsApi.delete.mockRejectedValue(new Error('Budget delete failed'));
    renderSettings();
    await waitFor(() => expect(screen.getByText('budgets')).toBeInTheDocument());
    fireEvent.click(screen.getByText('budgets'));
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      return expect(deleteButtons.length).toBeGreaterThan(0);
    });
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(budgetsApi.delete).toHaveBeenCalled());
    const toast = await import('react-hot-toast');
    expect(toast.default.error).toHaveBeenCalledWith('Budget delete failed');
  });

  it('switches to API Key tab', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('API Key')).toBeInTheDocument());
    fireEvent.click(screen.getByText('API Key'));
    await waitFor(() => expect(screen.getByText(/Vision API Key/)).toBeInTheDocument());
    expect(screen.getByPlaceholderText('zai-...')).toBeInTheDocument();
  });

  it('opens add account modal and creates account', async () => {
    mockSettingsData();
    accountsApi.create.mockResolvedValue({ data: { id: 'new' } });
    renderSettings();
    await waitFor(() => expect(screen.getByText('Add Account')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Account'));
    await waitFor(() => expect(screen.getByPlaceholderText(/Main Checking/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Main Checking/), { target: { value: 'Savings' } });
    fireEvent.click(screen.getByText('Create Account'));
    await waitFor(() => expect(accountsApi.create).toHaveBeenCalled());
  });

  it('handles account create error', async () => {
    mockSettingsData();
    accountsApi.create.mockRejectedValue(new Error('Create failed'));
    renderSettings();
    await waitFor(() => expect(screen.getByText('Add Account')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Account'));
    await waitFor(() => expect(screen.getByText('Create Account')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create Account'));
    await waitFor(() => expect(accountsApi.create).toHaveBeenCalled());
    const toast = await import('react-hot-toast');
    expect(toast.default.error).toHaveBeenCalledWith('Create failed');
  });

  it('opens add category modal and creates category', async () => {
    mockSettingsData();
    categoriesApi.create.mockResolvedValue({ data: { id: 'new' } });
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => expect(screen.getByText('Add Category')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Category'));
    await waitFor(() => expect(screen.getByPlaceholderText(/Hobbies/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Hobbies/), { target: { value: 'Hobbies' } });
    fireEvent.click(screen.getByText('Create Category'));
    await waitFor(() => expect(categoriesApi.create).toHaveBeenCalled());
  });

  it('handles category create error', async () => {
    mockSettingsData();
    categoriesApi.create.mockRejectedValue(new Error('Cat failed'));
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => expect(screen.getByText('Add Category')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Category'));
    await waitFor(() => expect(screen.getByPlaceholderText(/Hobbies/)).toBeInTheDocument());
    // Submit button is now disabled when name is empty - fill it first.
    fireEvent.change(screen.getByPlaceholderText(/Hobbies/), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Create Category'));
    await waitFor(() => expect(categoriesApi.create).toHaveBeenCalled());
    const toast = await import('react-hot-toast');
    expect(toast.default.error).toHaveBeenCalledWith('Cat failed');
  });

  it('opens add budget modal and creates budget', async () => {
    mockSettingsData();
    budgetsApi.create.mockResolvedValue({ data: { id: 'new' } });
    renderSettings();
    await waitFor(() => expect(screen.getByText('budgets')).toBeInTheDocument());
    fireEvent.click(screen.getByText('budgets'));
    await waitFor(() => expect(screen.getByText('Add Budget')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Budget'));
    await waitFor(() => expect(screen.getByPlaceholderText('500.00')).toBeInTheDocument());
    // Select first expense category from the dropdown so submit isn't disabled.
    const categorySelect = document.querySelector('#bud-cat');
    if (categorySelect && categorySelect.options.length > 1) {
      fireEvent.change(categorySelect, { target: { value: categorySelect.options[1].value } });
    }
    fireEvent.change(screen.getByPlaceholderText('500.00'), { target: { value: '300' } });
    fireEvent.click(screen.getByText('Create Budget'));
    await waitFor(() => expect(budgetsApi.create).toHaveBeenCalled());
  });

  it('saves API key', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('API Key')).toBeInTheDocument());
    fireEvent.click(screen.getByText('API Key'));
    await waitFor(() => expect(screen.getByPlaceholderText('zai-...')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('zai-...'), { target: { value: 'test-key' } });
    fireEvent.click(screen.getByText('Save API Key'));
    const toast = await import('react-hot-toast');
    expect(toast.default.success).toHaveBeenCalledWith(expect.stringMatching(/ZAI_API_KEY/));
  });

  it('closes account modal on Cancel', async () => {
    mockSettingsData();
    renderSettings();
    await waitFor(() => expect(screen.getByText('Add Account')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Add Account'));
    await waitFor(() => expect(screen.getByText('Cancel')).toBeInTheDocument());
    const cancelButtons = screen.getAllByText('Cancel');
    fireEvent.click(cancelButtons[0]);
    await waitFor(() => expect(screen.queryByText('Create Account')).not.toBeInTheDocument());
  });

  it('handles data load error', async () => {
    accountsApi.list.mockRejectedValue(new Error('Load failed'));
    categoriesApi.list.mockRejectedValue(new Error('Load failed'));
    budgetsApi.list.mockRejectedValue(new Error('Load failed'));
    renderSettings();
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
  });

  it('handles nested categories flattening', async () => {
    categoriesApi.list.mockResolvedValue({
      data: [
        { id: 'c1', name: 'Food', type: 'expense', color: '#3b82f6', is_system: false, children: [
          { id: 'c2', name: 'Groceries', type: 'expense', color: '#22c55e', is_system: false, children: [] },
        ]},
      ],
    });
    accountsApi.list.mockResolvedValue({ data: [] });
    budgetsApi.list.mockResolvedValue({ data: [] });
    renderSettings();
    await waitFor(() => expect(screen.getByText('categories')).toBeInTheDocument());
    fireEvent.click(screen.getByText('categories'));
    await waitFor(() => {
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });
  });
});
