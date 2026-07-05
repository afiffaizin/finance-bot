/**
 * Format angka ke format Rupiah
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format tanggal ke format Indonesia (1 Jan 2025)
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format tanggal singkat untuk chart (1/6)
 */
export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

/**
 * Generate daftar bulan (12 bulan terakhir) untuk dropdown
 */
export function getMonthOptions(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }

  return months;
}

/**
 * Get current month as YYYY-MM
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Warna untuk kategori di chart
 */
export const CATEGORY_COLORS: Record<string, string> = {
  makanan: '#ef4444',
  transport: '#f97316',
  tagihan: '#eab308',
  gaji: '#22c55e',
  belanja: '#3b82f6',
  hiburan: '#a855f7',
  kesehatan: '#ec4899',
  pendidikan: '#06b6d4',
  lainnya: '#6b7280',
};

export const PIE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#a855f7', '#ec4899', '#06b6d4', '#6b7280',
];
