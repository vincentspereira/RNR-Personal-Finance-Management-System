import { useState, useEffect } from 'react';
import { analyticsApi } from '../api';
import { PageHeader, LoadingSpinner, ErrorBoundary } from '../components/Common';
import {
  IncomeExpenseBarChart,
  ExpenseDonutChart,
  TopMerchantsBarChart,
  NetWorthOverTimeChart,
  CashflowForecastChart,
} from '../components/Charts';

const PERIODS = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'last_3m' },
  { label: 'Last 6 Months', value: 'last_6m' },
  { label: 'YTD', value: 'ytd' },
  { label: 'Last Year', value: 'last_year' },
];

function getDateRange(period) {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period) {
    case 'this_month':
      start.setDate(1); break;
    case 'last_month':
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0); break;
    case 'last_3m':
      start.setMonth(start.getMonth() - 3); break;
    case 'last_6m':
      start.setMonth(start.getMonth() - 6); break;
    case 'ytd':
      start.setMonth(0, 1); break;
    case 'last_year':
      start.setFullYear(start.getFullYear() - 1, 0, 1);
      end.setFullYear(end.getFullYear() - 1, 11, 31); break;
    default:
      start.setMonth(start.getMonth() - 1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
}

export default function Analytics() {
  const [period, setPeriod] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [byCategory, setByCategory] = useState([]);
  const [trends, setTrends] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [forecast, setForecast] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { startDate, endDate } = getDateRange(period);
      try {
        const [catRes, trendRes, merchantRes, recurringRes, nwRes, fcRes] = await Promise.all([
          analyticsApi.byCategory({ startDate, endDate, type: 'expense' }),
          analyticsApi.trends({ months: 12 }),
          analyticsApi.topMerchants({ startDate, endDate }),
          analyticsApi.recurring(),
          analyticsApi.netWorthHistory({ months: 12 }),
          analyticsApi.cashflowForecast({ days: 90 }),
        ]);
        setByCategory(catRes.data || []);
        setTrends(trendRes.data || []);
        setMerchants(merchantRes.data || []);
        setRecurring(recurringRes.data || []);
        setNetWorthHistory(nwRes.data || []);
        setForecast(fcRes.data || []);
      } catch (err) {
        console.error('Analytics error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [period]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        actions={
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Date range">
            {PERIODS.map(p => (
              <button
                key={p.value}
                className={`text-sm px-3 py-1.5 rounded-lg ${period === p.value ? 'bg-accent text-white' : 'btn-secondary'}`}
                onClick={() => setPeriod(p.value)}
                aria-pressed={period === p.value}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ErrorBoundary>
            <div className="card lg:col-span-2">
              <h3 className="text-sm font-medium text-muted mb-4">Net Worth Over Time (last 12 months)</h3>
              {netWorthHistory.length > 0 ? (
                <NetWorthOverTimeChart
                  data={netWorthHistory.map(r => ({ month: r.month, net_worth: parseFloat(r.net_worth) }))}
                />
              ) : (
                <p className="text-muted text-center py-12">Not enough history yet</p>
              )}
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="card lg:col-span-2">
              <h3 className="text-sm font-medium text-muted mb-4">Cash-flow Forecast (next 90 days)</h3>
              {forecast.length > 0 ? (
                <CashflowForecastChart
                  data={forecast.map(r => ({
                    date: r.date,
                    projected_income: parseFloat(r.projected_income),
                    projected_expense: parseFloat(r.projected_expense),
                    projected_net: parseFloat(r.projected_net),
                  }))}
                />
              ) : (
                <p className="text-muted text-center py-12">
                  Detect more recurring transactions to enable forecasting
                </p>
              )}
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="card">
              <h3 className="text-sm font-medium text-muted mb-4">Income vs Expense Trends</h3>
              <IncomeExpenseBarChart data={trends} />
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="card">
              <h3 className="text-sm font-medium text-muted mb-4">Expense Breakdown by Category</h3>
              {byCategory.length > 0 ? (
                <ExpenseDonutChart data={byCategory.map(c => ({ name: c.name, total: parseFloat(c.total) }))} />
              ) : (
                <p className="text-muted text-center py-12">No data for this period</p>
              )}
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="card">
              <h3 className="text-sm font-medium text-muted mb-4">Top Merchants</h3>
              {merchants.length > 0 ? (
                <TopMerchantsBarChart data={merchants.map(m => ({
                  merchant_name: m.merchant_name,
                  total_spent: parseFloat(m.total_spent),
                }))} />
              ) : (
                <p className="text-muted text-center py-12">No merchant data</p>
              )}
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="card">
              <h3 className="text-sm font-medium text-muted mb-4">Category Spending Details</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {byCategory.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between py-2 border-b border-default">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-primary">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">${parseFloat(cat.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span className="text-xs text-muted ml-2">({cat.transaction_count} txns)</span>
                    </div>
                  </div>
                ))}
                {byCategory.length === 0 && <p className="text-muted text-center py-8">No categories</p>}
              </div>
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="card lg:col-span-2">
              <h3 className="text-sm font-medium text-muted mb-4">Recurring Transactions</h3>
              {recurring.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-default">
                        <th scope="col" className="text-left py-2 px-3 text-muted">Description/Merchant</th>
                        <th scope="col" className="text-left py-2 px-3 text-muted">Avg Amount</th>
                        <th scope="col" className="text-left py-2 px-3 text-muted">Occurrences</th>
                        <th scope="col" className="text-left py-2 px-3 text-muted">Est. Monthly</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurring.map((r, i) => (
                        <tr key={i} className="border-b border-default">
                          <td className="py-2 px-3">{r.description || r.merchant_name || '—'}</td>
                          <td className="py-2 px-3">${parseFloat(r.avg_amount).toFixed(2)}</td>
                          <td className="py-2 px-3">{r.occurrence_count}</td>
                          <td className="py-2 px-3 text-income">${(parseFloat(r.avg_amount) * r.occurrence_count / 12).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted text-center py-8">Not enough data to detect recurring transactions</p>
              )}
            </div>
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
