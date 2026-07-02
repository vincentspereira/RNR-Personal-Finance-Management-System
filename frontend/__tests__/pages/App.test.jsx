import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../../src/App';

vi.mock('../../src/pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard</div>,
}));
vi.mock('../../src/pages/Transactions', () => ({
  default: () => <div data-testid="transactions">Transactions</div>,
}));
vi.mock('../../src/pages/Accounts', () => ({
  default: () => <div data-testid="accounts">Accounts</div>,
}));
vi.mock('../../src/pages/Scan', () => ({
  default: () => <div data-testid="scan">Scan</div>,
}));
vi.mock('../../src/pages/Analytics', () => ({
  default: () => <div data-testid="analytics">Analytics</div>,
}));
vi.mock('../../src/pages/Reports', () => ({
  default: () => <div data-testid="reports">Reports</div>,
}));
vi.mock('../../src/pages/Budgets', () => ({
  default: () => <div data-testid="budgets">Budgets</div>,
}));
vi.mock('../../src/pages/SavingsGoals', () => ({
  default: () => <div data-testid="savings-goals">SavingsGoals</div>,
}));
vi.mock('../../src/pages/Settings', () => ({
  default: () => <div data-testid="settings">Settings</div>,
}));
vi.mock('../../src/pages/Login', () => ({
  default: () => <div data-testid="login">Login</div>,
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'test@test.com', name: 'Test User' },
    token: 'mock-token',
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getAuthHeaders: vi.fn(),
  }),
  AuthProvider: ({ children }) => children,
}));

vi.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', toggle: vi.fn() }),
  ThemeProvider: ({ children }) => children,
}));

function renderApp(initial = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App', () => {
  it('renders Dashboard for / route', async () => {
    renderApp('/');
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('renders Dashboard for /dashboard route', async () => {
    renderApp('/dashboard');
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('renders Transactions for /transactions route', async () => {
    renderApp('/transactions');
    expect(await screen.findByTestId('transactions')).toBeInTheDocument();
  });

  it('renders Scan for /scan route', async () => {
    renderApp('/scan');
    expect(await screen.findByTestId('scan')).toBeInTheDocument();
  });

  it('renders Analytics for /analytics route', async () => {
    renderApp('/analytics');
    expect(await screen.findByTestId('analytics')).toBeInTheDocument();
  });

  it('renders Reports for /reports route', async () => {
    renderApp('/reports');
    expect(await screen.findByTestId('reports')).toBeInTheDocument();
  });

  it('renders Settings for /settings route', async () => {
    renderApp('/settings');
    expect(await screen.findByTestId('settings')).toBeInTheDocument();
  });

  it('renders Sidebar component', async () => {
    renderApp('/dashboard');
    expect(await screen.findByText('PFMS')).toBeInTheDocument();
  });

  it('toggles sidebar on button click', async () => {
    renderApp('/dashboard');
    expect(await screen.findByText('PFMS')).toBeInTheDocument();
    const toggleBtn = screen.getAllByRole('button').find(b => b.querySelector('svg'));
    fireEvent.click(toggleBtn);
    expect(screen.queryByText('PFMS')).not.toBeInTheDocument();
  });
});
