'use client';

import { getMonthOptions } from '@/lib/utils';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
}

export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const options = getMonthOptions();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
