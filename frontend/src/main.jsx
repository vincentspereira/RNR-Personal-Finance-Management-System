import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { ErrorBoundary, LoadingSpinner } from './components/Common';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, err) => {
        if (err?.status === 401 || err?.status === 403) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner label="Loading…" />}>
            <App />
          </Suspense>
        </ErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            // Themed via CSS variables so light/dark both look right.
            style: { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' },
            success: { iconTheme: { primary: 'var(--income)', secondary: 'var(--bg-secondary)' } },
            error: { iconTheme: { primary: 'var(--expense)', secondary: 'var(--bg-secondary)' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
