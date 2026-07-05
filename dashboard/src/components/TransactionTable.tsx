'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Transaction } from '@/lib/types';
import { fetchTransactions } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const CATEGORIES = [
  '', 'makanan', 'transport', 'tagihan', 'gaji',
  'belanja', 'hiburan', 'kesehatan', 'pendidikan', 'lainnya',
];

interface TransactionTableProps {
  month: string;
}

export default function TransactionTable({ month }: TransactionTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');

  const [year, mon] = month.split('-');
  const startDate = `${year}-${mon}-01`;
  const endDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
  const endDate = `${year}-${mon}-${String(endDay).padStart(2, '0')}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTransactions({
        start_date: startDate,
        end_date: endDate,
        category: filterCategory || undefined,
        type: filterType || undefined,
        limit: 100,
      });
      setTransactions(result.transactions);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterCategory, filterType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-gray-800">
          Daftar Transaksi ({total})
        </h3>
        <div className="flex gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Semua Kategori</option>
            {CATEGORIES.filter(Boolean).map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Semua Jenis</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-gray-400">Belum ada transaksi</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Jenis</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3">Keterangan</th>
                <th className="px-3 py-3 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="transition hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                    {formatDate(tx.transaction_date)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        tx.type === 'income'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {tx.type === 'income' ? 'Masuk' : 'Keluar'}
                    </span>
                  </td>
                  <td className="px-3 py-3 capitalize text-gray-700">{tx.category}</td>
                  <td className="px-3 py-3 text-gray-700">{tx.description}</td>
                  <td
                    className={`whitespace-nowrap px-3 py-3 text-right font-medium ${
                      tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
