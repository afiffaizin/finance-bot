'use client';

import { useState, useEffect, useCallback } from 'react';
import MonthPicker from '@/components/MonthPicker';
import SummaryCards from '@/components/SummaryCards';
import MonthlyChart from '@/components/MonthlyChart';
import CategoryPie from '@/components/CategoryPie';
import TransactionTable from '@/components/TransactionTable';
import { fetchSummary } from '@/lib/api';
import { getCurrentMonth } from '@/lib/utils';
import type { SummaryResponse } from '@/lib/types';

export default function Dashboard() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSummary(month);
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
      setError('Gagal memuat data. Pastikan backend sudah berjalan.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Keuangan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pantau pemasukan dan pengeluaran kamu via WhatsApp
          </p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
            <p className="text-sm text-gray-400">Memuat data...</p>
          </div>
        </div>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <SummaryCards
            totalIncome={summary.total_income}
            totalExpense={summary.total_expense}
            balance={summary.balance}
          />

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MonthlyChart data={summary.daily} />
            <CategoryPie data={summary.categories} />
          </div>

          {/* Transaction Table */}
          <TransactionTable month={month} />
        </>
      ) : null}
    </div>
  );
}
