import type { SummaryResponse, TransactionsResponse } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

export async function fetchSummary(month: string): Promise<SummaryResponse> {
  const res = await fetch(`${BASE_URL}/api/summary?month=${month}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch summary: ${res.status}`);
  return res.json();
}

export async function fetchTransactions(params: {
  start_date?: string;
  end_date?: string;
  category?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<TransactionsResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const res = await fetch(`${BASE_URL}/api/transactions?${searchParams.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`);
  return res.json();
}
