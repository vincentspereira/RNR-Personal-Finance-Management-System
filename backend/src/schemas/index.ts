/**
 * Zod request schemas — shared with the frontend via the `shared/` directory.
 * Keep these aligned with the corresponding TypeScript service inputs.
 */
import { z } from 'zod';

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const positiveAmount = z.number().positive().finite();
const txnType = z.enum(['income', 'expense', 'transfer']);

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(255),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['checking', 'savings', 'credit', 'cash', 'investment']),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  opening_balance: z.number().finite().optional(),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();

export const CreateTransactionSchema = z.object({
  account_id: uuid,
  category_id: uuid.optional().nullable(),
  type: txnType,
  amount: positiveAmount,
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  description: z.string().max(2000).optional().nullable(),
  merchant_name: z.string().max(255).optional().nullable(),
  transaction_date: isoDate,
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(64)).max(50).optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: z.any().optional(),
  source: z.enum(['manual', 'scanned', 'imported']).optional(),
  scan_id: uuid.optional().nullable(),
  import_hash: z.string().max(64).optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export const CreateTransferSchema = z.object({
  from_account_id: uuid,
  to_account_id: uuid,
  amount: positiveAmount,
  transaction_date: isoDate,
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(64)).max(50).optional(),
  category_id: uuid.optional(),
  fx_rate: z.number().positive().optional(),
}).refine(d => d.from_account_id !== d.to_account_id, {
  message: 'from_account_id and to_account_id must differ',
  path: ['to_account_id'],
});

export const CreateSplitSchema = z.object({
  account_id: uuid,
  total_amount: positiveAmount,
  type: z.enum(['income', 'expense']),
  transaction_date: isoDate,
  description: z.string().max(2000).optional(),
  merchant_name: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(64)).max(50).optional(),
  splits: z.array(z.object({
    category_id: uuid,
    amount: positiveAmount,
    description: z.string().max(2000).optional(),
  })).min(2),
});

export const CreateBudgetSchema = z.object({
  category_id: uuid,
  amount: positiveAmount,
  period: z.enum(['weekly', 'monthly', 'yearly']),
  start_date: isoDate,
  end_date: isoDate.optional(),
});

export const UpdateBudgetSchema = z.object({
  amount: positiveAmount.optional(),
  period: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  start_date: isoDate.optional(),
  end_date: isoDate.optional().nullable(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(100).optional(),
  parent_id: uuid.optional().nullable(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const CreateSavingsGoalSchema = z.object({
  name: z.string().min(1).max(255),
  target_amount: positiveAmount,
  current_amount: z.number().nonnegative().optional(),
  target_date: isoDate.optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const UpdateSavingsGoalSchema = CreateSavingsGoalSchema.partial().extend({
  is_completed: z.boolean().optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
export type CreateSplitInput = z.infer<typeof CreateSplitSchema>;
