/**
 * Centralised React Query hooks. Pages that adopt these instead of hand-rolled
 * useState + useEffect get: caching, dedupe, refetch-on-focus, optimistic
 * updates, and consistent cache invalidation on mutations.
 *
 * Naming: useThingQuery(...) -> useQuery; useThingMutation(...) -> useMutation.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  accountsApi,
  budgetsApi,
  categoriesApi,
  transactionsApi,
  analyticsApi,
  savingsGoalsApi,
  notificationsApi,
  recurringApi,
} from '../api';

// --- Accounts --------------------------------------------------------------

export function useAccountsQuery() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => (await accountsApi.list()).data,
  });
}

export function useCreateAccountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => accountsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => accountsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useArchiveAccountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => accountsApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

// --- Categories ------------------------------------------------------------

export function useCategoriesQuery() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data,
  });
}

export function useCreateCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => categoriesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignTo }) => categoriesApi.delete(id, reassignTo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

// --- Transactions ----------------------------------------------------------

export function useTransactionsQuery(filters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const r = await transactionsApi.list(filters);
      return { rows: r.data, pagination: r.meta?.pagination };
    },
    keepPreviousData: true,
  });
}

export function useCreateTransactionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => transactionsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransactionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => transactionsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteTransactionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => transactionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useCreateTransferMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => transactionsApi.createTransfer(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useCreateSplitMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => transactionsApi.createSplit(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// --- Analytics -------------------------------------------------------------

export function useAnalyticsSummaryQuery(params) {
  return useQuery({
    queryKey: ['analytics', 'summary', params],
    queryFn: async () => (await analyticsApi.summary(params)).data,
  });
}

export function useNetWorthQuery() {
  return useQuery({
    queryKey: ['analytics', 'net-worth'],
    queryFn: async () => (await analyticsApi.netWorth()).data,
  });
}

export function useNetWorthHistoryQuery(months = 12) {
  return useQuery({
    queryKey: ['analytics', 'net-worth-history', months],
    queryFn: async () => (await analyticsApi.netWorthHistory({ months })).data,
  });
}

export function useCashflowForecastQuery(days = 90) {
  return useQuery({
    queryKey: ['analytics', 'cashflow-forecast', days],
    queryFn: async () => (await analyticsApi.cashflowForecast({ days })).data,
  });
}

// --- Budgets ---------------------------------------------------------------

export function useBudgetsQuery() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => (await budgetsApi.list()).data,
  });
}

export function useCreateBudgetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => budgetsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

// --- Savings goals ---------------------------------------------------------

export function useSavingsGoalsQuery() {
  return useQuery({
    queryKey: ['savings-goals'],
    queryFn: async () => (await savingsGoalsApi.list()).data,
  });
}

// --- Notifications ---------------------------------------------------------

export function useNotificationsQuery(params) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => (await notificationsApi.list(params)).data,
  });
}

// --- Recurring -------------------------------------------------------------

export function useRecurringQuery() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => (await recurringApi.list()).data,
  });
}
