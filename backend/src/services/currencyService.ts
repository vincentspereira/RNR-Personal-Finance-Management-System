import NodeCache from 'node-cache';
import { query } from '../db';

const rateCache = new NodeCache({ stdTTL: 3600 }); // 1-hour cache

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'BRL', 'MXN', 'SGD'];

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
}

async function fetchRates(base: string = 'USD'): Promise<ExchangeRates> {
  const cacheKey = `rates_${base}`;
  const cached = rateCache.get<ExchangeRates>(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `https://api.exchangerate-api.com/v4/latest/${base}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rates: ${response.status}`);
  }

  const data = (await response.json()) as { base: string; rates: Record<string, number> };
  const rates: ExchangeRates = {
    base: data.base,
    rates: data.rates,
    fetchedAt: new Date().toISOString(),
  };

  rateCache.set(cacheKey, rates);
  return rates;
}

export async function getRates(base?: string) {
  const result = await fetchRates(base || 'USD');
  return {
    base: result.base,
    rates: SUPPORTED_CURRENCIES.reduce((acc, cur) => {
      acc[cur] = result.rates[cur] || 1;
      return acc;
    }, {} as Record<string, number>),
    fetchedAt: result.fetchedAt,
  };
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<{ original: number; converted: number; rate: number; from: string; to: string }> {
  if (from === to) {
    return { original: amount, converted: amount, rate: 1, from, to };
  }

  const rates = await fetchRates(from);
  const rate = rates.rates[to];

  if (!rate) {
    throw new Error(`Unsupported currency conversion: ${from} -> ${to}`);
  }

  return {
    original: amount,
    converted: Math.round(amount * rate * 100) / 100,
    rate,
    from,
    to,
  };
}

export async function getUserBaseCurrency(userId: string): Promise<string> {
  const result = await query(
    'SELECT currency FROM accounts WHERE user_id = $1 AND is_archived = false ORDER BY created_at LIMIT 1',
    [userId]
  );
  return result.rows[0]?.currency || 'USD';
}

export async function convertToBaseCurrency(
  userId: string,
  amount: number,
  currency: string
): Promise<number> {
  if (!currency || currency === 'USD') return amount;

  const baseCurrency = await getUserBaseCurrency(userId);
  if (currency === baseCurrency) return amount;

  const result = await convertCurrency(amount, currency, baseCurrency);
  return result.converted;
}

/**
 * Lightweight helper used by transferService — returns the converted amount
 * and the rate used. Falls back to 1.0 if both currencies match.
 */
export async function convertAmount(
  amount: number,
  from: string,
  to: string
): Promise<{ amount: number; rate: number }> {
  if (from === to) return { amount, rate: 1 };
  const res = await convertCurrency(amount, from, to);
  return { amount: res.converted, rate: res.rate };
}

export { SUPPORTED_CURRENCIES };
