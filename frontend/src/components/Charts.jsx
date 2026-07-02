import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, LineChart, Line,
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

const tooltipStyle = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' },
  labelStyle: { color: '#94a3b8' },
};

export function IncomeExpenseBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Legend />
        <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ExpenseDonutChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ color: '#94a3b8' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CashflowAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Legend />
        <Area type="monotone" dataKey="income" stackId="1" stroke="#22c55e" fill="#22c55e33" name="Income" />
        <Area type="monotone" dataKey="expense" stackId="2" stroke="#ef4444" fill="#ef444433" name="Expenses" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data, lines }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Legend />
        {(lines || [{ key: 'income', color: '#22c55e' }, { key: 'expense', color: '#ef4444' }]).map((line) => (
          <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={2} dot={false} name={line.name || line.key} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function NetWorthOverTimeChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Legend />
        <Area
          type="monotone"
          dataKey="net_worth"
          stroke="#3b82f6"
          fill="#3b82f633"
          name="Net Worth"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CashflowForecastChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
        <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Legend />
        <Line type="monotone" dataKey="projected_income" stroke="#22c55e" strokeDasharray="5 4" dot={false} name="Projected income" />
        <Line type="monotone" dataKey="projected_expense" stroke="#ef4444" strokeDasharray="5 4" dot={false} name="Projected expense" />
        <Line type="monotone" dataKey="projected_net" stroke="#3b82f6" strokeWidth={2} dot={false} name="Projected net" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopMerchantsBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis type="number" stroke="#64748b" tick={{ fontSize: 12 }} />
        <YAxis dataKey="merchant_name" type="category" stroke="#64748b" tick={{ fontSize: 11 }} width={120} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="total_spent" fill="#3b82f6" name="Total Spent" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
