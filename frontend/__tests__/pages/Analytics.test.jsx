import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Analytics from '../../src/pages/Analytics';

vi.mock('../../src/api', () => ({
  analyticsApi: {
    byCategory: vi.fn(),
    trends: vi.fn(),
    topMerchants: vi.fn(),
    recurring: vi.fn(),
    netWorthHistory: vi.fn(),
    cashflowForecast: vi.fn(),
  },
}));

import { analyticsApi } from '../../src/api';

const mockAnalyticsData = () => {
  analyticsApi.byCategory.mockResolvedValue({
    data: [
      { id: 'c1', name: 'Groceries', total: 500, type: 'expense', color: '#3b82f6', transaction_count: 10 },
      { id: 'c2', name: 'Dining', total: 300, type: 'expense', color: '#ef4444', transaction_count: 5 },
    ],
  });
  analyticsApi.trends.mockResolvedValue({
    data: [
      { month: '2026-01', income: 5000, expense: 3000 },
    ],
  });
  analyticsApi.topMerchants.mockResolvedValue({
    data: [
      { merchant_name: 'Amazon', total_spent: 800 },
    ],
  });
  analyticsApi.recurring.mockResolvedValue({
    data: [
      { description: 'Netflix', merchant_name: 'Netflix', avg_amount: 15.99, occurrence_count: 6 },
    ],
  });
  analyticsApi.netWorthHistory.mockResolvedValue({
    data: [{ month: '2026-01', net_worth: '1000.00' }],
  });
  analyticsApi.cashflowForecast.mockResolvedValue({
    data: [],
  });
};

const renderAnalytics = () =>
  render(
    <BrowserRouter>
      <Analytics />
    </BrowserRouter>
  );

describe('Analytics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading spinner initially', () => {
    mockAnalyticsData();
    renderAnalytics();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders analytics page with chart sections after loading', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('Income vs Expense Trends')).toBeInTheDocument());
    expect(screen.getByText('Expense Breakdown by Category')).toBeInTheDocument();
    expect(screen.getByText('Top Merchants')).toBeInTheDocument();
    expect(screen.getByText('Category Spending Details')).toBeInTheDocument();
  });

  it('renders period selector buttons', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('This Month')).toBeInTheDocument());
    expect(screen.getByText('Last Month')).toBeInTheDocument();
    expect(screen.getByText('Last 3 Months')).toBeInTheDocument();
    expect(screen.getByText('YTD')).toBeInTheDocument();
  });

  it('switches period and reloads data', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('Last Month')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Last Month'));
    await waitFor(() => expect(analyticsApi.byCategory).toHaveBeenCalledTimes(2));
  });

  it('shows category details with transaction counts', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText(/10 txns/)).toBeInTheDocument();
    });
  });

  it('shows recurring transactions table', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => {
      expect(screen.getByText('Recurring Transactions')).toBeInTheDocument();
      expect(screen.getByText('Netflix')).toBeInTheDocument();
    });
  });

  it('shows empty states when no data', async () => {
    analyticsApi.byCategory.mockResolvedValue({ data: [] });
    analyticsApi.trends.mockResolvedValue({ data: [] });
    analyticsApi.topMerchants.mockResolvedValue({ data: [] });
    analyticsApi.recurring.mockResolvedValue({ data: [] });
    analyticsApi.netWorthHistory.mockResolvedValue({ data: [] });
    analyticsApi.cashflowForecast.mockResolvedValue({ data: [] });
    renderAnalytics();
    await waitFor(() => {
      expect(screen.getByText(/No data for this period/)).toBeInTheDocument();
      expect(screen.getByText(/No merchant data/)).toBeInTheDocument();
      expect(screen.getByText(/Not enough data to detect recurring/)).toBeInTheDocument();
    });
  });

  it('renders top merchants section when data exists', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('Top Merchants')).toBeInTheDocument());
  });

  it('shows category details with colors', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('Groceries')).toBeInTheDocument());
    const colorDots = document.querySelectorAll('[style="background-color: rgb(59, 130, 246);"]');
    expect(colorDots.length).toBeGreaterThan(0);
  });

  it('handles API errors gracefully', async () => {
    analyticsApi.byCategory.mockRejectedValue(new Error('API error'));
    analyticsApi.trends.mockRejectedValue(new Error('API error'));
    analyticsApi.topMerchants.mockRejectedValue(new Error('API error'));
    analyticsApi.recurring.mockRejectedValue(new Error('API error'));
    analyticsApi.netWorthHistory.mockRejectedValue(new Error('API error'));
    analyticsApi.cashflowForecast.mockRejectedValue(new Error('API error'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('Analytics')).toBeInTheDocument());
    errorSpy.mockRestore();
  });

  it('switches to last 3 months period', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('Last 3 Months')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Last 3 Months'));
    await waitFor(() => expect(analyticsApi.byCategory).toHaveBeenCalledTimes(2));
  });

  it('switches to YTD period', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('YTD')).toBeInTheDocument());
    fireEvent.click(screen.getByText('YTD'));
    await waitFor(() => expect(analyticsApi.byCategory).toHaveBeenCalledTimes(2));
  });

  it('switches to last year period', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('Last Year')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Last Year'));
    await waitFor(() => expect(analyticsApi.byCategory).toHaveBeenCalledTimes(2));
  });

  it('switches to last 6 months period', async () => {
    mockAnalyticsData();
    renderAnalytics();
    await waitFor(() => expect(screen.getByText('Last 6 Months')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Last 6 Months'));
    await waitFor(() => expect(analyticsApi.byCategory).toHaveBeenCalledTimes(2));
  });
});
