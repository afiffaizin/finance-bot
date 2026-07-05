'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DailyData } from '@/lib/types';
import { formatCurrency, formatShortDate } from '@/lib/utils';

interface MonthlyChartProps {
  data: DailyData[];
}

export default function MonthlyChart({ data }: MonthlyChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-gray-400">Belum ada data transaksi</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    name: formatShortDate(d.date),
  }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-800">
        Tren Pemasukan vs Pengeluaran
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => {
              const n = Number(v);
              return n >= 1000000 ? `${(n / 1000000).toFixed(1)}jt` : n >= 1000 ? `${(n / 1000).toFixed(0)}rb` : String(n);
            }}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === 'income' ? 'Pemasukan' : 'Pengeluaran',
            ]}
            labelFormatter={(label) => `Tanggal: ${label}`}
          />
          <Legend
            formatter={(value: string) => (value === 'income' ? 'Pemasukan' : 'Pengeluaran')}
          />
          <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
