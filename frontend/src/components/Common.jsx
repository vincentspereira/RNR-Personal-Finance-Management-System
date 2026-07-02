import { useEffect, useRef } from 'react';
import { FaArrowUp, FaArrowDown } from 'react-icons/fa';

export function KPICard({ title, value, change, prefix = '$', suffix = '', icon: Icon, color = 'accent' }) {
  const isPositive = change >= 0;
  return (
    <div className="card" role="group" aria-label={title}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">{title}</span>
        {Icon && <Icon className={`text-${color}`} aria-hidden="true" />}
      </div>
      <div className="text-2xl font-bold">{prefix}{Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}{suffix}</div>
      {change !== null && change !== undefined && (
        <div className={`flex items-center mt-1 text-sm ${isPositive ? 'text-income' : 'text-expense'}`}>
          {isPositive
            ? <FaArrowUp className="mr-1" aria-hidden="true" />
            : <FaArrowDown className="mr-1" aria-hidden="true" />}
          <span className="sr-only">{isPositive ? 'Up' : 'Down'}</span>
          {Math.abs(change).toFixed(1)}% vs last period
        </div>
      )}
    </div>
  );
}

export function DataTable({ columns, data, onRowClick, emptyMessage = 'No data found' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-default">
            {columns.map((col) => (
              <th key={col.key} scope="col" className="text-left py-3 px-4 text-muted font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center py-8 text-muted">{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                className={`border-b border-default hover:bg-tertiary transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(row)}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }}
              >
                {columns.map((col) => (
                  <td key={col.key} className="py-3 px-4">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus management: remember the focused element on open, restore on close, and
  // trap focus + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;
    const firstFocusable = dialogRef.current?.querySelector(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-secondary border border-default rounded-xl p-4 sm:p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-primary text-xl"
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Badge({ children, color = 'blue' }) {
  const colors = {
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    blue: 'bg-blue-500/20 text-blue-400',
    gray: 'bg-gray-500/20 text-gray-400',
  };
  return <span className={`badge ${colors[color] || colors.blue}`}>{children}</span>;
}

export function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-8 bg-tertiary rounded animate-pulse w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card">
          <div className="h-4 bg-tertiary rounded animate-pulse w-1/2 mb-2" />
          <div className="h-4 bg-tertiary rounded animate-pulse w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ title, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

/**
 * Minimal app-level error boundary. Wrap routes/views with <ErrorBoundary>.
 * Prevents a render error in one chart from blanking the entire page.
 */
import { Component } from 'react';
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    if (typeof window !== 'undefined' && window.console) {
      console.error('UI error:', error, info?.componentStack);
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="card border-default" role="alert">
          <h3 className="font-bold mb-2 text-expense">Something went wrong</h3>
          <p className="text-sm text-muted mb-3">
            The page hit an unexpected error. Refresh to try again.
          </p>
          <button className="btn-secondary" onClick={() => this.setState({ error: null })}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
