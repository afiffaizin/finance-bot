'use client';

import { formatCurrency } from '@/lib/utils';

interface SummaryCardsProps {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export default function SummaryCards({ totalIncome, totalExpense, balance }: SummaryCardsProps) {
  const cards = [
    {
      title: 'Total Pemasukan',
      value: totalIncome,
      color: 'bg-emerald-50 border-emerald-200',
      textColor: 'text-emerald-700',
      valueColor: 'text-emerald-600',
      icon: '💰',
    },
    {
      title: 'Total Pengeluaran',
      value: totalExpense,
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-700',
      valueColor: 'text-red-600',
      icon: '💸',
    },
    {
      title: 'Saldo Bersih',
      value: balance,
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-700',
      valueColor: balance >= 0 ? 'text-blue-600' : 'text-red-600',
      icon: '📊',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-xl border p-5 shadow-sm transition hover:shadow-md ${card.color}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{card.icon}</span>
            <h3 className={`text-sm font-medium ${card.textColor}`}>{card.title}</h3>
          </div>
          <p className={`mt-3 text-2xl font-bold ${card.valueColor}`}>
            {formatCurrency(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
