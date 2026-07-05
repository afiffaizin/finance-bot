'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import type { CategoryData } from '@/lib/types';
import { formatCurrency, PIE_COLORS } from '@/lib/utils';

interface CategoryPieProps {
  data: CategoryData[];
}

export default function CategoryPie({ data }: CategoryPieProps) {
  // Filter hanya expense untuk pie chart
  const expenseData = data
    .filter((d) => d.type === 'expense')
    .map((d) => ({
      name: d.category,
      value: d.total,
    }));

  if (expenseData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-gray-400">Belum ada data pengeluaran</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-800">
        Distribusi Pengeluaran per Kategori
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={expenseData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            label={(props: PieLabelRenderProps) => {
              const name = props.name || '';
              const percent = props.percent || 0;
              return `${name} ${(percent * 100).toFixed(0)}%`;
            }}
          >
            {expenseData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
